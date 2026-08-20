using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/workouts")]
[Authorize]
public class WorkoutsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;
    private readonly HevyClient _hevy;

    public WorkoutsController(AppDbContext db, UserManager<AppUser> users, HevyClient hevy)
    {
        _db = db;
        _users = users;
        _hevy = hevy;
    }

    private string UserId => _users.GetUserId(User)!;

    // The stored payload is handed to the client verbatim as a JsonElement, so
    // it has to be written in the casing the API uses everywhere else —
    // serializing with the defaults would emit PascalCase and the client would
    // read undefined out of every field.
    private static readonly JsonSerializerOptions PayloadOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 90)
    {
        var from = DateOnly.FromDateTime(DateTime.Today.AddDays(-days));
        var logs = await _db.WorkoutLogs
            .Where(w => w.UserId == UserId && w.Date >= from)
            .OrderByDescending(w => w.Date).ThenByDescending(w => w.StartedAt)
            .ToListAsync();
        return Ok(logs.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var log = await _db.WorkoutLogs.FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);
        if (log is null) return NotFound();
        return Ok(ToDetailDto(log));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var log = await _db.WorkoutLogs.FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);
        if (log is null) return NotFound();
        _db.WorkoutLogs.Remove(log);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("sync/status")]
    public IActionResult SyncStatus() => Ok(new { configured = _hevy.IsConfigured, source = "hevy" });

    /// <summary>
    /// Pulls recent sessions from Hevy. Rows are keyed by the provider's id, so
    /// running this repeatedly updates what is already there rather than
    /// duplicating it, and nothing entered elsewhere can be silently replaced.
    /// </summary>
    [HttpPost("sync")]
    public async Task<IActionResult> Sync([FromQuery] int pages = 4, CancellationToken ct = default)
    {
        if (!_hevy.IsConfigured)
            return StatusCode(503, new { message = "Hevy ist nicht konfiguriert." });

        List<HevyWorkout> workouts;
        try
        {
            workouts = await _hevy.FetchRecentAsync(Math.Clamp(pages, 1, 20), ct);
        }
        catch (HevyException exc)
        {
            return StatusCode(502, new { message = exc.Message });
        }

        var ids = workouts.Select(w => w.Id).ToList();
        var existing = await _db.WorkoutLogs
            .Where(w => w.UserId == UserId && w.Source == "hevy" && ids.Contains(w.ExternalId))
            .ToDictionaryAsync(w => w.ExternalId, ct);

        int added = 0, updated = 0;
        foreach (var w in workouts)
        {
            if (string.IsNullOrEmpty(w.Id)) continue;

            var setCount = w.Exercises.Sum(e => e.Sets.Count);
            var volume = w.Exercises
                .SelectMany(e => e.Sets)
                .Sum(s => (s.WeightKg ?? 0m) * (s.Reps ?? 0));

            if (existing.TryGetValue(w.Id, out var row))
            {
                updated++;
            }
            else
            {
                row = new WorkoutLog { Id = Guid.NewGuid(), UserId = UserId, Source = "hevy", ExternalId = w.Id };
                _db.WorkoutLogs.Add(row);
                added++;
            }

            row.Date = w.Date;
            row.StartedAt = w.StartedAt;
            row.Title = w.Title;
            row.DurationMinutes = w.DurationMinutes;
            row.ExerciseCount = w.Exercises.Count;
            row.SetCount = setCount;
            row.VolumeKg = Math.Round(volume, 1);
            row.RawText = Render(w);
            row.PayloadJson = JsonSerializer.Serialize(w.Exercises, PayloadOptions);
            row.SyncedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { added, updated, total = workouts.Count });
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

    private static object ToDto(WorkoutLog w) => new
    {
        w.Id,
        Date = w.Date.ToString("yyyy-MM-dd"),
        w.Title,
        w.DurationMinutes,
        w.ExerciseCount,
        w.SetCount,
        w.VolumeKg,
        w.Source,
        w.SyncedAt,
    };

    private static object ToDetailDto(WorkoutLog w) => new
    {
        w.Id,
        Date = w.Date.ToString("yyyy-MM-dd"),
        w.Title,
        w.DurationMinutes,
        w.ExerciseCount,
        w.SetCount,
        w.VolumeKg,
        w.Source,
        w.SyncedAt,
        w.RawText,
        Exercises = JsonSerializer.Deserialize<JsonElement>(w.PayloadJson),
    };
}
