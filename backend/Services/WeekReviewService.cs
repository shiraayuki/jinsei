using Microsoft.EntityFrameworkCore;

/// <summary>
/// The week, against the week before it.
///
/// Deliberately not the plain-text week log, which is a paste block: seven day
/// lines and an average, all of it saying what happened and none of it saying
/// whether that was better or worse than last time. A review is the comparison
/// — every number here carries the same number from the previous week beside
/// it, and the reading is left to the reader. No prose, no praise.
///
/// JSON rather than rendered text, so the client says it in whichever language
/// the account is set to instead of a second German template living here.
/// </summary>
public class WeekReviewService
{
    private readonly AppDbContext _db;

    public WeekReviewService(AppDbContext db) => _db = db;

    /// <summary>A calorie day counts as on target within this much of the goal.</summary>
    private const double OnTargetTolerance = 0.10;

    public sealed record Change(double? Now, double? Before, double? Goal);

    public sealed record WeekReview(
        string WeekStart,
        string WeekEnd,
        Change Sessions,
        Change Sets,
        Change VolumeKg,
        Change SleepMinutes,
        int SleepNights,
        Change Kcal,
        int KcalDays,
        int KcalOnTargetDays,
        Change ProteinG,
        Change Steps,
        Change TrendWeightKg,
        double? RatePerWeekKg,
        int? KcalGoal,
        bool KcalGoalSetThisWeek);

    public static DateOnly MondayOf(DateOnly date) =>
        date.AddDays(-(int)((((int)date.DayOfWeek + 6) % 7)));

    public async Task<WeekReview> BuildAsync(string userId, DateOnly anyDayOfWeek, CancellationToken ct = default)
    {
        var monday = MondayOf(anyDayOfWeek);
        var sunday = monday.AddDays(6);
        var prevMonday = monday.AddDays(-7);

        // One read covering both weeks, then split in memory: two round trips
        // per table for numbers that are always shown side by side is a query
        // pattern nobody benefits from.
        var food = await _db.NutritionEntries
            .Where(e => e.UserId == userId && e.Date >= prevMonday && e.Date <= sunday)
            .ToListAsync(ct);
        var move = await _db.ActivityEntries
            .Where(e => e.UserId == userId && e.Date >= prevMonday && e.Date <= sunday)
            .ToListAsync(ct);
        var sleep = await _db.SleepEntries
            .Where(e => e.UserId == userId && e.Date >= prevMonday && e.Date <= sunday)
            .ToListAsync(ct);
        var workouts = await _db.WorkoutLogs
            .Where(w => w.UserId == userId && w.Date >= prevMonday && w.Date <= sunday)
            .ToListAsync(ct);

        // The weight trend needs a run-up: a seven-day mean at Monday is made
        // of the days before Monday.
        var weights = await _db.WeightEntries
            .Where(e => e.UserId == userId && e.Date >= prevMonday.AddDays(-21) && e.Date <= sunday && e.WeightKg != null)
            .OrderBy(e => e.Date)
            .ToListAsync(ct);

        var user = await _db.Users.FirstAsync(u => u.Id == userId, ct);

        List<T> ThisWeek<T>(List<T> rows, Func<T, DateOnly> date) =>
            rows.Where(r => date(r) >= monday && date(r) <= sunday).ToList();
        List<T> LastWeek<T>(List<T> rows, Func<T, DateOnly> date) =>
            rows.Where(r => date(r) >= prevMonday && date(r) < monday).ToList();

        var foodNow = ThisWeek(food, e => e.Date);
        var foodBefore = LastWeek(food, e => e.Date);
        var moveNow = ThisWeek(move, e => e.Date);
        var moveBefore = LastWeek(move, e => e.Date);
        var sleepNow = ThisWeek(sleep, e => e.Date);
        var sleepBefore = LastWeek(sleep, e => e.Date);
        var trainNow = ThisWeek(workouts, w => w.Date);
        var trainBefore = LastWeek(workouts, w => w.Date);

        var kcalNow = foodNow.Select(e => e.Kcal).OfType<int>().ToList();
        var onTarget = user.KcalGoal is int goal
            ? kcalNow.Count(k => Math.Abs(k - goal) <= goal * OnTargetTolerance)
            : 0;

        var trendEnd = TrailingMean(weights, sunday);
        var trendStart = TrailingMean(weights, monday.AddDays(-1));

        return new WeekReview(
            monday.ToString("yyyy-MM-dd"),
            sunday.ToString("yyyy-MM-dd"),
            new Change(trainNow.Count, trainBefore.Count, user.WeeklyWorkoutsGoal),
            new Change(trainNow.Sum(w => w.SetCount), trainBefore.Sum(w => w.SetCount), user.WeeklySetsGoal),
            new Change((double)Math.Round(trainNow.Sum(w => w.VolumeKg)), (double)Math.Round(trainBefore.Sum(w => w.VolumeKg)), null),
            new Change(
                Mean(sleepNow.Select(e => e.ActualSleepMinutes ?? e.TimeInBedMinutes).OfType<int>()),
                Mean(sleepBefore.Select(e => e.ActualSleepMinutes ?? e.TimeInBedMinutes).OfType<int>()),
                user.SleepGoalMinutes),
            sleepNow.Count,
            new Change(Mean(kcalNow), Mean(foodBefore.Select(e => e.Kcal).OfType<int>()), user.KcalGoal),
            kcalNow.Count,
            onTarget,
            new Change(
                Mean(foodNow.Select(e => e.ProteinG).OfType<int>()),
                Mean(foodBefore.Select(e => e.ProteinG).OfType<int>()),
                user.ProteinGoal),
            new Change(
                Mean(moveNow.Select(e => e.Steps).OfType<int>()),
                Mean(moveBefore.Select(e => e.Steps).OfType<int>()),
                user.StepsGoal),
            new Change(trendEnd, trendStart, (double?)user.WeightGoalKg),
            trendEnd != null && trendStart != null ? Math.Round(trendEnd.Value - trendStart.Value, 2) : null,
            user.KcalGoal,
            user.KcalGoalUpdatedAt is DateTimeOffset written
                && DateOnly.FromDateTime(written.UtcDateTime) >= monday);
    }

    private static double? Mean(IEnumerable<int> values)
    {
        var list = values.ToList();
        return list.Count > 0 ? Math.Round(list.Average(), 1) : null;
    }

    /// <summary>
    /// The seven-day mean of the weigh-ins up to and including a day, which is
    /// the trend weight at that day. Null when there is nothing behind it —
    /// a single reading is a morning, not a trend.
    /// </summary>
    private static double? TrailingMean(List<WeightEntry> weights, DateOnly upTo)
    {
        var window = weights
            .Where(e => e.Date <= upTo && e.Date > upTo.AddDays(-7))
            .Select(e => (double)e.WeightKg!.Value)
            .ToList();
        return window.Count >= 2 ? Math.Round(window.Average(), 2) : null;
    }
}
