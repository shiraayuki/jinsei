using System.Globalization;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Keeps the training log current without anyone pressing the button. Pull
/// only, once a day at a fixed local time: Hevy has no way to notify us, and a
/// session logged after a push would otherwise sit unseen until the next
/// manual sync. An evening slot is deliberate — the day's training is done by
/// then, so one pull is enough.
/// </summary>
public class HevySyncScheduler : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _config;
    private readonly ILogger<HevySyncScheduler> _log;

    public HevySyncScheduler(IServiceScopeFactory scopes, IConfiguration config, ILogger<HevySyncScheduler> log)
    {
        _scopes = scopes;
        _config = config;
        _log = log;
    }

    /// <summary>The local time of day to sync at, "HH:mm". Defaults to 19:30.</summary>
    private TimeOnly SyncAt =>
        TimeOnly.TryParseExact(_config["Hevy:SyncAtLocal"], "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var at)
            ? at
            : new TimeOnly(19, 30);

    /// <summary>
    /// The same zone the sessions are dated in, so the slot does not drift by
    /// an hour when the clocks change.
    /// </summary>
    private TimeZoneInfo Zone
    {
        get
        {
            var id = _config["Hevy:TimeZone"] ?? "Europe/Vienna";
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
        }
    }

    /// <summary>
    /// How long until the next slot. Computed against the wall clock on every
    /// pass rather than by adding 24 hours to the last run, so a container that
    /// was down over the slot picks the next one up instead of drifting.
    /// </summary>
    private TimeSpan UntilNextSlot()
    {
        var zone = Zone;
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone).DateTime;
        var slot = now.Date + SyncAt.ToTimeSpan();
        if (slot <= now) slot = slot.AddDays(1);

        DateTime utc;
        try
        {
            utc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(slot, DateTimeKind.Unspecified), zone);
        }
        catch (ArgumentException)
        {
            // The slot falls in the hour that does not exist on the night the
            // clocks go forward. Once a year, an hour late is fine.
            utc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(slot.AddHours(1), DateTimeKind.Unspecified), zone);
        }

        var delay = utc - DateTime.UtcNow;
        return delay > TimeSpan.Zero ? delay : TimeSpan.FromMinutes(1);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Let the app finish starting before doing any work.
        try { await Task.Delay(TimeSpan.FromSeconds(30), ct); }
        catch (OperationCanceledException) { return; }

        // One pull on startup, so a deploy does not leave the log a day stale,
        // and after that only the daily slot.
        await SyncEveryoneAsync(ct);

        while (!ct.IsCancellationRequested)
        {
            try { await Task.Delay(UntilNextSlot(), ct); }
            catch (OperationCanceledException) { return; }

            await SyncEveryoneAsync(ct);
        }
    }

    private async Task SyncEveryoneAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var sync = scope.ServiceProvider.GetRequiredService<WorkoutSyncService>();
            if (!sync.IsConfigured) return;

            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var userIds = await db.Users.Select(u => u.Id).ToListAsync(ct);

            foreach (var userId in userIds)
            {
                // Two pages is a fortnight of training; the button pulls deeper
                // when a backfill is actually wanted.
                var result = await sync.SyncAsync(userId, pages: 2, ct);
                if (result.Added > 0)
                    _log.LogInformation("Hevy sync added {Added} workout(s) for {UserId}.", result.Added, userId);
            }
        }
        catch (HevyException exc)
        {
            // Hevy being unreachable is not worth a stack trace every few hours.
            _log.LogWarning("Scheduled Hevy sync skipped: {Message}", exc.Message);
        }
        catch (Exception exc)
        {
            _log.LogError(exc, "Scheduled Hevy sync failed.");
        }
    }
}
