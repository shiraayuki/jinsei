using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/workouts/stats")]
[Authorize]
public class WorkoutStatsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public WorkoutStatsController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    // GET /api/workouts/stats/volume?weeks=12
    [HttpGet("volume")]
    public async Task<IActionResult> Volume([FromQuery] int weeks = 12)
    {
        var cutoff = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-weeks * 7);

        var workouts = await _db.Workouts
            .Include(w => w.WorkoutExercises)
                .ThenInclude(we => we.Sets)
            .Where(w => w.UserId == UserId && w.Date >= cutoff)
            .ToListAsync();

        var byWeek = workouts
            .GroupBy(w => GetWeekStart(w.Date))
            .Select(g => new WeeklyVolumeDto(
                g.Key,
                (double)g.SelectMany(w => w.WorkoutExercises)
                         .SelectMany(we => we.Sets)
                         .Where(s => s.WeightKg.HasValue && s.Reps.HasValue)
                         .Sum(s => s.WeightKg!.Value * s.Reps!.Value),
                g.Count()
            ))
            .OrderBy(x => x.WeekStart)
            .ToList();

        // Fill missing weeks with zeros
        var result = FillWeeks(cutoff, weeks, byWeek, w => w.WeekStart,
            d => new WeeklyVolumeDto(d, 0, 0));

        return Ok(result);
    }

    // GET /api/workouts/stats/frequency?weeks=12
    [HttpGet("frequency")]
    public async Task<IActionResult> Frequency([FromQuery] int weeks = 12)
    {
        var cutoff = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-weeks * 7);

        var workouts = await _db.Workouts
            .Where(w => w.UserId == UserId && w.Date >= cutoff)
            .ToListAsync();

        var byWeek = workouts
            .GroupBy(w => GetWeekStart(w.Date))
            .Select(g => new WeeklyFrequencyDto(
                g.Key,
                g.Count(),
                g.Sum(w => w.DurationMinutes ?? 0)
            ))
            .OrderBy(x => x.WeekStart)
            .ToList();

        var result = FillWeeks(cutoff, weeks, byWeek, w => w.WeekStart,
            d => new WeeklyFrequencyDto(d, 0, 0));

        return Ok(result);
    }

    // GET /api/workouts/stats/prs
    [HttpGet("prs")]
    public async Task<IActionResult> PersonalRecords()
    {
        var sets = await _db.WorkoutSets
            .Include(s => s.WorkoutExercise)
                .ThenInclude(we => we.Exercise)
            .Include(s => s.WorkoutExercise)
                .ThenInclude(we => we.Workout)
            .Where(s =>
                s.WorkoutExercise.Workout.UserId == UserId &&
                s.WeightKg != null && s.WeightKg > 0 &&
                s.Reps != null && s.Reps > 0)
            .ToListAsync();

        var prs = sets
            .GroupBy(s => new { s.WorkoutExercise.ExerciseId, s.WorkoutExercise.Exercise.Name })
            .Select(g =>
            {
                var best = g.MaxBy(s => Epley(s.WeightKg!.Value, s.Reps!.Value))!;
                return new PrDto(
                    g.Key.ExerciseId,
                    g.Key.Name,
                    (double)best.WeightKg!,
                    best.Reps!.Value,
                    Math.Round(Epley(best.WeightKg!.Value, best.Reps!.Value), 1),
                    best.WorkoutExercise.Workout.Date
                );
            })
            .OrderByDescending(x => x.Estimated1Rm)
            .ToList();

        return Ok(prs);
    }

    // GET /api/workouts/stats/exercise/{exerciseId}/progression?days=90
    [HttpGet("exercise/{exerciseId:guid}/progression")]
    public async Task<IActionResult> ExerciseProgression(Guid exerciseId, [FromQuery] int days = 90)
    {
        var cutoff = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-days);

        var sets = await _db.WorkoutSets
            .Include(s => s.WorkoutExercise)
                .ThenInclude(we => we.Workout)
            .Where(s =>
                s.WorkoutExercise.Workout.UserId == UserId &&
                s.WorkoutExercise.ExerciseId == exerciseId &&
                s.WorkoutExercise.Workout.Date >= cutoff &&
                s.WeightKg != null && s.WeightKg > 0 &&
                s.Reps != null && s.Reps > 0)
            .ToListAsync();

        var progression = sets
            .GroupBy(s => s.WorkoutExercise.Workout.Date)
            .Select(g =>
            {
                var top = g.MaxBy(s => Epley(s.WeightKg!.Value, s.Reps!.Value))!;
                return new ProgressionPointDto(
                    g.Key,
                    (double)top.WeightKg!,
                    top.Reps!.Value,
                    Math.Round(Epley(top.WeightKg!.Value, top.Reps!.Value), 1)
                );
            })
            .OrderBy(x => x.Date)
            .ToList();

        return Ok(progression);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static DateOnly GetWeekStart(DateOnly date)
    {
        int daysBack = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-daysBack);
    }

    private static double Epley(decimal weight, int reps) =>
        (double)weight * (1 + reps / 30.0);

    private static List<T> FillWeeks<T>(
        DateOnly cutoff, int weeks, List<T> data,
        Func<T, DateOnly> getKey, Func<DateOnly, T> empty)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = GetWeekStart(cutoff);
        var lookup = data.ToDictionary(getKey);
        var result = new List<T>();

        for (var d = start; d <= today; d = d.AddDays(7))
            result.Add(lookup.TryGetValue(d, out var item) ? item : empty(d));

        return result;
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────

public record WeeklyVolumeDto(DateOnly WeekStart, double TotalVolumeKg, int WorkoutCount);

public record WeeklyFrequencyDto(DateOnly WeekStart, int WorkoutCount, int TotalMinutes);

public record PrDto(
    Guid ExerciseId,
    string ExerciseName,
    double BestWeightKg,
    int BestReps,
    double Estimated1Rm,
    DateOnly AchievedAt
);

public record ProgressionPointDto(DateOnly Date, double WeightKg, int Reps, double Estimated1Rm);
