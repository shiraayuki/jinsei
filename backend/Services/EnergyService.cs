using Microsoft.EntityFrameworkCore;

/// <summary>
/// What maintenance actually is, and what the week's intake should therefore
/// be — measured rather than modelled.
///
/// The same arithmetic used to live only in the browser, where it ran over
/// whichever range the chart above it happened to be showing: the week's
/// target moved when you flipped from 90 days to 7. It is here now because a
/// weekly job has no browser to ask, and because one window, stated once, is
/// the only way the number on the screen and the number that gets written are
/// the same number.
/// </summary>
public class EnergyService
{
    private readonly AppDbContext _db;

    public EnergyService(AppDbContext db) => _db = db;

    /// <summary>A kilogram of body mass is roughly this many kilocalories of stored energy.</summary>
    public const double KcalPerKg = 7700;

    /// <summary>Logged calorie days and weigh-ins before the estimate is worth having.</summary>
    public const int MinKcalDays = 14;
    public const int MinWeighIns = 8;

    /// <summary>
    /// The window every part of the estimate is measured over.
    ///
    /// Four weeks: long enough that a regression through the weigh-ins means
    /// something, short enough that it is this month's rate rather than the
    /// average of a year in which the diet changed twice.
    /// </summary>
    public const int WindowDays = 28;

    private sealed record Reading(DateOnly Date, double Value);

    /// <summary>
    /// The week's numbers. Everything is nullable because the honest answer
    /// before there is enough logged is nothing at all — the counts are there
    /// so a screen can say how far off the answer is instead of showing a dash.
    /// </summary>
    public sealed record EnergyTarget(
        double? Tdee,
        double? MeanKcal,
        double? RatePerWeek,
        double? AnchorWeightKg,
        double? WeeklyKg,
        int? TargetKcal,
        int KcalDays,
        int WeighIns,
        decimal? RatePercent);

    public async Task<EnergyTarget> ComputeAsync(string userId, DateOnly today, CancellationToken ct = default)
    {
        var from = today.AddDays(-(WindowDays - 1));

        var weights = await _db.WeightEntries
            .Where(e => e.UserId == userId && e.Date >= from && e.Date <= today && e.WeightKg != null)
            .OrderBy(e => e.Date)
            .Select(e => new Reading(e.Date, (double)e.WeightKg!.Value))
            .ToListAsync(ct);

        var kcal = await _db.NutritionEntries
            .Where(e => e.UserId == userId && e.Date >= from && e.Date <= today && e.Kcal != null)
            .OrderBy(e => e.Date)
            .Select(e => new Reading(e.Date, (double)e.Kcal!.Value))
            .ToListAsync(ct);

        var user = await _db.Users.FirstAsync(u => u.Id == userId, ct);
        var ratePercent = user.WeeklyRatePercent;

        var meanKcal = kcal.Count > 0 ? kcal.Average(r => r.Value) : (double?)null;
        var ratePerWeek = SlopePerDay(weights) * 7;

        // Both floors, or nothing: the estimate is a difference between two
        // noisy series, and below them the noise is the answer.
        var tdee = meanKcal != null && ratePerWeek != null
                   && kcal.Count >= MinKcalDays && weights.Count >= MinWeighIns
            ? meanKcal - ratePerWeek.Value / 7 * KcalPerKg
            : null;

        var anchor = AnchorWeight(weights, today);
        var weeklyKg = ratePercent != null && anchor != null
            ? anchor * ((double)ratePercent.Value / 100)
            : null;

        var target = tdee != null && weeklyKg != null
            ? (int)Math.Round(tdee.Value - weeklyKg.Value * KcalPerKg / 7)
            : (int?)null;

        return new EnergyTarget(
            tdee, meanKcal, ratePerWeek, anchor, weeklyKg, target,
            kcal.Count, weights.Count, ratePercent);
    }

    /// <summary>
    /// Writes the measured target into the user's calorie goal, and stamps
    /// when that happened. Returns what was written, or null when there was no
    /// target to write — which is the normal state for the first fortnight.
    /// </summary>
    public async Task<int?> ApplyAsync(string userId, DateOnly today, CancellationToken ct = default)
    {
        var result = await ComputeAsync(userId, today, ct);
        if (result.TargetKcal is not int target) return null;

        var user = await _db.Users.FirstAsync(u => u.Id == userId, ct);
        user.KcalGoal = target;
        user.KcalGoalUpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return target;
    }

    /// <summary>The Monday of the week a date falls in.</summary>
    public static DateOnly MondayOf(DateOnly date) =>
        date.AddDays(-(int)((((int)date.DayOfWeek + 6) % 7)));

    /// <summary>
    /// The weight the target is computed from: the trend, frozen at this week's
    /// Monday.
    ///
    /// Not the last weigh-in — that swings by a kilo on salt and water alone,
    /// which would move the target by sixty kilocalories from one morning to
    /// the next. Frozen at Monday, the number holds still for seven days and
    /// then steps down on its own as the trend does.
    /// </summary>
    private static double? AnchorWeight(IReadOnlyList<Reading> weights, DateOnly today)
    {
        var trend = TrailingAverage(weights, window: 7, minReadings: 3);
        var monday = MondayOf(today);

        // A first week with nothing behind it falls back to what is known,
        // rather than withholding a target until next Monday.
        var settled = trend.Where(r => r.Date <= monday).ToList();
        return settled.Count > 0 ? settled[^1].Value
             : trend.Count > 0 ? trend[^1].Value
             : null;
    }

    /// <summary>
    /// The mean of the last <paramref name="window"/> readings at each reading —
    /// readings, not days, so a week with three weigh-ins still produces a
    /// trend. Readings before the minimum is met carry no value at all.
    /// </summary>
    private static List<Reading> TrailingAverage(IReadOnlyList<Reading> points, int window, int minReadings)
    {
        var seen = new List<double>();
        var result = new List<Reading>();
        foreach (var p in points)
        {
            seen.Add(p.Value);
            var slice = seen.Skip(Math.Max(0, seen.Count - window)).ToList();
            if (slice.Count >= minReadings) result.Add(new Reading(p.Date, slice.Average()));
        }
        return result;
    }

    /// <summary>
    /// Least-squares slope over the readings, per day. x is the calendar
    /// distance rather than the index, so a week with three weigh-ins and a
    /// week with seven produce comparable rates.
    /// </summary>
    private static double? SlopePerDay(IReadOnlyList<Reading> points)
    {
        if (points.Count < 3) return null;

        var xs = points.Select(p => (double)p.Date.DayNumber).ToList();
        var ys = points.Select(p => p.Value).ToList();
        var mx = xs.Average();
        var my = ys.Average();

        var denom = xs.Sum(x => (x - mx) * (x - mx));
        if (denom == 0) return null;

        return xs.Zip(ys, (x, y) => (x - mx) * (y - my)).Sum() / denom;
    }
}
