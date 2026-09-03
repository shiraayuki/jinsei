using System.Globalization;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Generates the day's report once, late at night, for anyone who did not
/// already trigger one by hand.
///
/// Same daily-at-local-time shape as <see cref="CalorieTargetScheduler"/> and
/// <see cref="HevySyncScheduler"/> — <c>UntilNextSlot</c> recomputes against
/// the wall clock so a downed container catches the next slot rather than
/// drifting. Unlike those two, there is no run-once-on-startup catch-up: a
/// missed sync is a slightly stale number, but an unconditional boot-time run
/// here would spend a real `claude` invocation on every restart. A row already
/// existing for the day — manual or scheduled — is reason enough to skip, both
/// so a manual run is never clobbered and so a scheduler bug cannot quietly
/// burn through the day's usage on repeat runs.
/// </summary>
public class DailyReportScheduler : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _config;
    private readonly ILogger<DailyReportScheduler> _log;

    public DailyReportScheduler(
        IServiceScopeFactory scopes, IConfiguration config, ILogger<DailyReportScheduler> log)
    {
        _scopes = scopes;
        _config = config;
        _log = log;
    }

    private TimeOnly RunAt =>
        TimeOnly.TryParseExact(_config["Reports:RunAtLocal"], "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var at)
            ? at
            : new TimeOnly(23, 30);

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
        while (!ct.IsCancellationRequested)
        {
            try { await Task.Delay(UntilNextSlot(), ct); }
            catch (OperationCanceledException) { return; }

            await RunAsync(ct);
        }
    }

    private async Task RunAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var today = LocalToday;
        var userIds = await db.Users.Select(u => u.Id).ToListAsync(ct);

        foreach (var userId in userIds)
        {
            try
            {
                if (await db.DailyReports.AnyAsync(r => r.UserId == userId && r.Date == today, ct))
                    continue;

                var reports = scope.ServiceProvider.GetRequiredService<DailyReportService>();
                await reports.GenerateAsync(userId, today, DailyReportSource.Scheduled, ct);
                _log.LogInformation("Daily report generated for {UserId}.", userId);
            }
            catch (Exception exc)
            {
                _log.LogError(exc, "Daily report generation failed for {UserId}.", userId);
            }
        }
    }
}
