using System.Globalization;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Pulls the calorie goal along behind the measurement, once a week.
///
/// Everything it needs already existed — the measured need, the anchor weight,
/// the chosen pace — and all of it waited for a button. A deficit only holds
/// while the target keeps up with a need that falls as the weight does, and
/// nobody remembers to press a button every Monday.
///
/// It runs daily rather than only on Mondays, and each user is brought up to
/// date if this week's Monday is newer than the last write. A container that
/// was down over Monday therefore catches up on Tuesday instead of skipping
/// the week — the same reason the Hevy slot is recomputed against the wall
/// clock rather than by adding a day to the last run.
/// </summary>
public class CalorieTargetScheduler : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _config;
    private readonly ILogger<CalorieTargetScheduler> _log;

    public CalorieTargetScheduler(
        IServiceScopeFactory scopes, IConfiguration config, ILogger<CalorieTargetScheduler> log)
    {
        _scopes = scopes;
        _config = config;
        _log = log;
    }

    /// <summary>
    /// Early morning, before the day's first weigh-in is entered: the target is
    /// computed from the trend frozen at Monday, so it should be waiting when
    /// the week starts rather than arriving halfway through it.
    /// </summary>
    private TimeOnly RunAt =>
        TimeOnly.TryParseExact(_config["Energy:RunAtLocal"], "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var at)
            ? at
            : new TimeOnly(4, 30);

    private TimeZoneInfo Zone
    {
        get
        {
            var id = _config["Hevy:TimeZone"] ?? "Europe/Vienna";
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
        }
    }

    private DateOnly LocalToday => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Zone).DateTime);

    private TimeSpan UntilNextSlot()
    {
        var zone = Zone;
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone).DateTime;
        var slot = now.Date + RunAt.ToTimeSpan();
        if (slot <= now) slot = slot.AddDays(1);

        DateTime utc;
        try
        {
            utc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(slot, DateTimeKind.Unspecified), zone);
        }
        catch (ArgumentException)
        {
            // The hour that does not exist on the night the clocks go forward.
            utc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(slot.AddHours(1), DateTimeKind.Unspecified), zone);
        }

        var delay = utc - DateTime.UtcNow;
        return delay > TimeSpan.Zero ? delay : TimeSpan.FromMinutes(1);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(45), ct); }
        catch (OperationCanceledException) { return; }

        await RunAsync(ct);

        while (!ct.IsCancellationRequested)
        {
            try { await Task.Delay(UntilNextSlot(), ct); }
            catch (OperationCanceledException) { return; }

            await RunAsync(ct);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var energy = scope.ServiceProvider.GetRequiredService<EnergyService>();

            var today = LocalToday;
            var monday = EnergyService.MondayOf(today);

            // Only the users who asked for it, and only those whose goal has
            // not already been written this week.
            var due = await db.Users
                .Where(u => u.AutoKcalGoal && u.WeeklyRatePercent != null)
                .Select(u => new { u.Id, u.KcalGoalUpdatedAt })
                .ToListAsync(ct);

            foreach (var user in due)
            {
                if (user.KcalGoalUpdatedAt is DateTimeOffset last
                    && DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(last, Zone).DateTime) >= monday)
                    continue;

                var applied = await energy.ApplyAsync(user.Id, today, ct);
                if (applied is int target)
                    _log.LogInformation("Calorie goal set to {Target} kcal for {UserId}.", target, user.Id);
            }
        }
        catch (Exception exc)
        {
            _log.LogError(exc, "Weekly calorie target update failed.");
        }
    }
}
