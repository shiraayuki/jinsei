using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

public record SyncResult(int Added, int Updated, int Total, int CardioDays);

/// <summary>
/// Pulls sessions from Hevy into the log. Rows are keyed by the provider's id,
/// so running this repeatedly updates what is already there rather than
/// duplicating it. Shared by the sync button and the background schedule.
/// </summary>
public class WorkoutSyncService
{
    private readonly AppDbContext _db;
    private readonly HevyClient _hevy;

    public WorkoutSyncService(AppDbContext db, HevyClient hevy)
    {
        _db = db;
        _hevy = hevy;
    }

    public bool IsConfigured => _hevy.IsConfigured;

    // The payload is handed to the client verbatim as a JsonElement, so it has
    // to be written in the casing the API uses everywhere else — serializing
    // with the defaults would emit PascalCase and the client would read
    // undefined out of every field.
    private static readonly JsonSerializerOptions PayloadOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public async Task<SyncResult> SyncAsync(string userId, int pages, CancellationToken ct = default)
    {
        var workouts = await _hevy.FetchRecentAsync(Math.Clamp(pages, 1, 20), ct);

        var ids = workouts.Select(w => w.Id).ToList();
        var existing = await _db.WorkoutLogs
            .Where(w => w.UserId == userId && w.Source == "hevy" && ids.Contains(w.ExternalId))
            .ToDictionaryAsync(w => w.ExternalId, ct);

        int added = 0, updated = 0;
        foreach (var w in workouts)
        {
            if (string.IsNullOrEmpty(w.Id)) continue;

            if (existing.TryGetValue(w.Id, out var row))
            {
                updated++;
            }
            else
            {
                row = new WorkoutLog { Id = Guid.NewGuid(), UserId = userId, Source = "hevy", ExternalId = w.Id };
                _db.WorkoutLogs.Add(row);
                added++;
            }

            row.Date = w.Date;
            row.StartedAt = w.StartedAt;
            row.Title = w.Title;
            row.DurationMinutes = w.DurationMinutes;
            row.ExerciseCount = w.Exercises.Count;
            row.SetCount = w.Exercises.Sum(e => e.Sets.Count);
            row.VolumeKg = Math.Round(
                w.Exercises.SelectMany(e => e.Sets).Sum(s => (s.WeightKg ?? 0m) * (s.Reps ?? 0)), 1);
            row.RawText = Render(w);
            row.PayloadJson = JsonSerializer.Serialize(w.Exercises, PayloadOptions);
            row.SyncedAt = DateTimeOffset.UtcNow;
        }

        var cardioDays = await FillCardioAsync(userId, workouts, ct);

        await _db.SaveChangesAsync(ct);
        return new SyncResult(added, updated, workouts.Count, cardioDays);
    }

    /// <summary>
    /// Sets carrying a duration or a distance are cardio, whether that is a
    /// dedicated session or ten minutes on the treadmill afterwards. The day's
    /// activity entry is only filled where nothing has been said about cardio
    /// yet — an answer given by hand is never overwritten by a sync.
    /// </summary>
    private async Task<int> FillCardioAsync(string userId, List<HevyWorkout> workouts, CancellationToken ct)
    {
        var byDay = workouts
            .Where(w => w.Exercises.Any(e => e.Sets.Any(s => s.DurationSeconds > 0 || s.DistanceMeters > 0)))
            .GroupBy(w => w.Date)
            .ToDictionary(
                g => g.Key,
                g => (int)Math.Round(g.SelectMany(w => w.Exercises)
                    .SelectMany(e => e.Sets)
                    .Sum(s => s.DurationSeconds ?? 0) / 60.0));

        if (byDay.Count == 0) return 0;

        var days = byDay.Keys.ToList();
        var existing = await _db.ActivityEntries
            .Where(a => a.UserId == userId && days.Contains(a.Date))
            .ToDictionaryAsync(a => a.Date, ct);

        var filled = 0;
        foreach (var (day, minutes) in byDay)
        {
            if (existing.TryGetValue(day, out var entry))
            {
                if (entry.Cardio is not null) continue;
            }
            else
            {
                entry = new ActivityEntry { Id = Guid.NewGuid(), UserId = userId, Date = day };
                _db.ActivityEntries.Add(entry);
            }

            entry.Cardio = true;
            if (minutes > 0) entry.CardioMinutes = minutes;
            entry.LoggedAt = DateTimeOffset.UtcNow;
            filled++;
        }

        return filled;
    }

    /// <summary>Readable rendering of a session, in the shape Hevy's share text uses.</summary>
    private static string Render(HevyWorkout w)
    {
        var sb = new StringBuilder();
        sb.AppendLine(w.Title);
        foreach (var ex in w.Exercises)
        {
            sb.AppendLine(ex.Name);
            for (var i = 0; i < ex.Sets.Count; i++)
            {
                var s = ex.Sets[i];
                if (s.DurationSeconds is > 0)
                    sb.AppendLine($"Satz {i + 1}: {Math.Round(s.DurationSeconds.Value / 60d, 1)} min");
                else if (s.WeightKg is > 0)
                    sb.AppendLine($"Satz {i + 1}: {s.WeightKg:0.##} kg x {s.Reps ?? 0}");
                else
                    sb.AppendLine($"Satz {i + 1}: {s.Reps ?? 0}");
            }
        }
        return sb.ToString().TrimEnd();
    }
}
