using System.Text.Json;
using System.Text.Json.Serialization;

/// <summary>
/// Turns the stored session payloads into the numbers a training decision is
/// made on: what moved, what did not, and which muscle group is being carried
/// by the programme rather than trained by it.
///
/// It reads <see cref="WorkoutLog.PayloadJson"/> rather than the session
/// summary columns, because every question below — a working weight, an
/// estimated max, sets per muscle group — lives inside the sets and nowhere
/// else. The summary columns only know how many there were.
/// </summary>
public static class WorkoutAnalyticsService
{
    private static readonly JsonSerializerOptions PayloadOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    /// <summary>Sets above this rep count make Epley's estimate unusable.</summary>
    private const int MaxRepsForEstimate = 12;

    /// <summary>A lift with no new best in this many weeks has stopped moving.</summary>
    private const int StagnationWeeks = 4;

    public static WorkoutAnalytics Build(IReadOnlyList<WorkoutLog> logs, DateOnly today, int days)
    {
        var sessions = logs
            .Select(log => new Session(log.Date, log.DurationMinutes, Parse(log.PayloadJson)))
            .OrderBy(s => s.Date)
            .ToList();

        return new WorkoutAnalytics(
            days,
            BuildWeekly(sessions, today, days),
            BuildMuscleGroups(sessions, today),
            BuildExercises(sessions, today),
            BuildTotals(sessions));
    }

    // ── Weekly load ─────────────────────────────────────────────────────────

    private static List<WeeklyLoad> BuildWeekly(List<Session> sessions, DateOnly today, int days)
    {
        var from = MondayOf(today.AddDays(-(days - 1)));
        var weeks = new List<WeeklyLoad>();

        for (var week = from; week <= today; week = week.AddDays(7))
        {
            var end = week.AddDays(6);
            var inWeek = sessions.Where(s => s.Date >= week && s.Date <= end).ToList();
            weeks.Add(new WeeklyLoad(
                week.ToString("yyyy-MM-dd"),
                inWeek.Count,
                inWeek.Sum(s => s.Exercises.Sum(e => e.Sets.Count)),
                Math.Round(inWeek.Sum(s => s.Volume), 1),
                inWeek.Sum(s => s.DurationMinutes ?? 0)));
        }

        return weeks;
    }

    // ── Muscle groups ───────────────────────────────────────────────────────

    private static List<MuscleGroupLoad> BuildMuscleGroups(List<Session> sessions, DateOnly today)
    {
        // Two windows rather than one: sets per week only says something next to
        // the week before it.
        var currentFrom = today.AddDays(-27);
        var previousFrom = today.AddDays(-55);

        var rows = new Dictionary<string, (int sets, decimal volume, int prevSets, DateOnly? last)>();

        foreach (var session in sessions)
        {
            foreach (var exercise in session.Exercises)
            {
                var group = MuscleGroupOf(exercise);
                var working = exercise.Sets.Count(s => s.Reps is > 0 || s.DurationSeconds is > 0);
                var volume = exercise.Sets.Sum(s => (s.WeightKg ?? 0m) * (s.Reps ?? 0));

                rows.TryGetValue(group, out var row);
                if (session.Date >= currentFrom)
                {
                    row.sets += working;
                    row.volume += volume;
                    if (row.last is null || session.Date > row.last) row.last = session.Date;
                }
                else if (session.Date >= previousFrom)
                {
                    row.prevSets += working;
                }
                rows[group] = row;
            }
        }

        return rows
            .Where(r => r.Value.sets > 0 || r.Value.prevSets > 0)
            .Select(r => new MuscleGroupLoad(
                r.Key,
                r.Value.sets,
                // A four-week window divided by four is the number people
                // actually programme against.
                Math.Round(r.Value.sets / 4.0, 1),
                Math.Round(r.Value.volume, 1),
                r.Value.prevSets,
                r.Value.last is DateOnly d ? today.DayNumber - d.DayNumber : null))
            .OrderByDescending(r => r.Sets)
            .ToList();
    }

    // ── Per exercise ────────────────────────────────────────────────────────

    private static List<ExerciseProgress> BuildExercises(List<Session> sessions, DateOnly today)
    {
        var byName = new Dictionary<string, List<(DateOnly Date, ParsedExercise Exercise)>>(StringComparer.OrdinalIgnoreCase);
        foreach (var session in sessions)
            foreach (var exercise in session.Exercises)
            {
                if (!byName.TryGetValue(exercise.Name, out var list))
                    byName[exercise.Name] = list = [];
                list.Add((session.Date, exercise));
            }

        var result = new List<ExerciseProgress>();

        foreach (var (name, occurrences) in byName)
        {
            var history = occurrences
                .GroupBy(o => o.Date)
                .OrderBy(g => g.Key)
                .Select(g =>
                {
                    var sets = g.SelectMany(o => o.Exercise.Sets).ToList();
                    var top = sets
                        .Where(s => s.WeightKg is > 0 && s.Reps is > 0 and <= MaxRepsForEstimate)
                        .Select(s => new { s.WeightKg, s.Reps, E1rm = Epley(s.WeightKg!.Value, s.Reps!.Value) })
                        .OrderByDescending(s => s.E1rm)
                        .FirstOrDefault();

                    return new ExerciseSession(
                        g.Key.ToString("yyyy-MM-dd"),
                        sets.Count,
                        Math.Round(sets.Sum(s => (s.WeightKg ?? 0m) * (s.Reps ?? 0)), 1),
                        top is null ? null : Math.Round(top.E1rm, 1),
                        top?.WeightKg,
                        top?.Reps);
                })
                .ToList();

            var estimates = history.Where(h => h.EstimatedOneRepMax is not null).ToList();
            var last = history[^1];
            var lastDate = DateOnly.Parse(last.Date);

            decimal? best = estimates.Count > 0 ? estimates.Max(h => h.EstimatedOneRepMax) : null;
            decimal? first = estimates.Count > 0 ? estimates[0].EstimatedOneRepMax : null;
            decimal? latest = estimates.Count > 0 ? estimates[^1].EstimatedOneRepMax : null;

            // Stagnation is a best that is old, not a bad last session: one
            // light day after a deload is not a stalled lift.
            var cutoff = today.AddDays(-7 * StagnationWeeks);
            var bestDate = estimates.Count > 0
                ? DateOnly.Parse(estimates.OrderByDescending(h => h.EstimatedOneRepMax).First().Date)
                : (DateOnly?)null;
            var stagnant = estimates.Count >= 4
                && bestDate is DateOnly bd
                && bd < cutoff
                && lastDate >= cutoff;

            result.Add(new ExerciseProgress(
                name,
                history.Count,
                last.Date,
                today.DayNumber - lastDate.DayNumber,
                best,
                first,
                latest,
                first is > 0 && latest is not null
                    ? Math.Round((latest.Value - first.Value) / first.Value * 100, 1)
                    : null,
                stagnant,
                bestDate?.ToString("yyyy-MM-dd"),
                history));
        }

        return result
            .OrderByDescending(e => e.Sessions)
            .ThenBy(e => e.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static WorkoutTotals BuildTotals(List<Session> sessions) => new(
        sessions.Count,
        sessions.Sum(s => s.Exercises.Sum(e => e.Sets.Count)),
        Math.Round(sessions.Sum(s => s.Volume), 1),
        sessions.Where(s => s.DurationMinutes is > 0).Select(s => s.DurationMinutes!.Value).ToList() is { Count: > 0 } durations
            ? (int)Math.Round(durations.Average())
            : null);

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static decimal Epley(decimal weight, int reps) => weight * (1 + reps / 30m);

    private static DateOnly MondayOf(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));

    private static List<ParsedExercise> Parse(string payload)
    {
        try
        {
            return JsonSerializer.Deserialize<List<ParsedExercise>>(payload, PayloadOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>
    /// The group Hevy reported, or a guess from the name for sessions synced
    /// before the catalogue was being read. The guess is deliberately coarse —
    /// it decides which bucket a set lands in, not what the set was.
    /// </summary>
    private static string MuscleGroupOf(ParsedExercise exercise)
    {
        if (exercise.MuscleGroup is { Length: > 0 } reported) return reported;

        var name = exercise.Name.ToLowerInvariant();
        foreach (var (group, needles) in NameHints)
            if (needles.Any(name.Contains))
                return group;
        return "other";
    }

    private static readonly (string Group, string[] Needles)[] NameHints =
    [
        ("chest", ["bench", "chest", "fly", "flye", "dip", "brust", "drück"]),
        ("back", ["row", "pulldown", "pull up", "pull-up", "pullup", "chin", "lat", "rudern", "klimmzug"]),
        ("shoulders", ["shoulder", "overhead press", "ohp", "lateral", "raise", "schulter", "seitheben"]),
        ("biceps", ["curl", "bizeps", "biceps"]),
        ("triceps", ["tricep", "trizeps", "pushdown", "skull", "extension (tricep"]),
        ("quadriceps", ["squat", "leg press", "lunge", "leg extension", "kniebeuge", "beinpresse"]),
        ("hamstrings", ["deadlift", "rdl", "leg curl", "good morning", "kreuzheben", "beinbeuger"]),
        ("glutes", ["hip thrust", "glute", "gesäß"]),
        ("calves", ["calf", "wade"]),
        ("abdominals", ["crunch", "plank", "ab wheel", "sit up", "situp", "bauch", "hanging leg"]),
        ("cardio", ["run", "bike", "cycl", "row erg", "treadmill", "elliptical", "laufen", "rad"]),
    ];

    private sealed record Session(DateOnly Date, int? DurationMinutes, List<ParsedExercise> Exercises)
    {
        public decimal Volume => Exercises.Sum(e => e.Sets.Sum(s => (s.WeightKg ?? 0m) * (s.Reps ?? 0)));
    }

    private sealed record ParsedExercise(string Name, List<ParsedSet> Sets, string? MuscleGroup)
    {
        public List<ParsedSet> Sets { get; init; } = Sets ?? [];
    }

    private sealed record ParsedSet(decimal? WeightKg, int? Reps, int? DurationSeconds, decimal? DistanceMeters);
}

public record WorkoutAnalytics(
    int Days,
    List<WeeklyLoad> Weekly,
    List<MuscleGroupLoad> MuscleGroups,
    List<ExerciseProgress> Exercises,
    WorkoutTotals Totals);

public record WorkoutTotals(int Sessions, int Sets, decimal VolumeKg, int? AverageDurationMinutes);

public record WeeklyLoad(string WeekStart, int Sessions, int Sets, decimal VolumeKg, int DurationMinutes);

public record MuscleGroupLoad(
    string Group,
    int Sets,
    double SetsPerWeek,
    decimal VolumeKg,
    int PreviousSets,
    int? DaysSince);

public record ExerciseSession(
    string Date,
    int Sets,
    decimal VolumeKg,
    decimal? EstimatedOneRepMax,
    decimal? TopSetWeightKg,
    int? TopSetReps);

public record ExerciseProgress(
    string Name,
    int Sessions,
    string LastDate,
    int DaysSince,
    decimal? BestOneRepMax,
    decimal? FirstOneRepMax,
    decimal? LatestOneRepMax,
    decimal? ChangePercent,
    bool Stagnant,
    string? BestDate,
    List<ExerciseSession> History);
