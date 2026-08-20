using Microsoft.EntityFrameworkCore;

/// <summary>
/// Keeps the training log current without anyone pressing the button. Pull
/// only, on a fixed interval: Hevy has no way to notify us, and a session
/// logged after a push would otherwise sit unseen until the next manual sync.
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

    private TimeSpan Interval =>
        TimeSpan.FromMinutes(Math.Max(15, _config.GetValue("Hevy:SyncIntervalMinutes", 180)));

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Let the app finish starting before doing any work.
        try { await Task.Delay(TimeSpan.FromSeconds(30), ct); }
        catch (OperationCanceledException) { return; }

        while (!ct.IsCancellationRequested)
        {
            await SyncEveryoneAsync(ct);

            try { await Task.Delay(Interval, ct); }
            catch (OperationCanceledException) { return; }
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
