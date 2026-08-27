using System.Globalization;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// The three things worth interrupting someone about, over the one channel
/// that exists.
///
/// It ticks every few minutes rather than once a day, because a habit reminder
/// is set to a time of day and a slot missed by six hours is noise rather than
/// a reminder. Each pass covers the window since the last one, so nothing in
/// that window fires twice and nothing between two ticks is skipped; a window
/// longer than a quarter of an hour is discarded instead of replayed, which is
/// what stops a container that was off all afternoon from delivering its whole
/// afternoon at once.
/// </summary>
public class NotificationScheduler : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationScheduler> _log;

    /// <summary>How often the window is checked.</summary>
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(5);

    /// <summary>A gap longer than this is a restart, not a delay, and is dropped.</summary>
    private static readonly TimeSpan MaxCatchUp = TimeSpan.FromMinutes(15);

    private DateTimeOffset _lastRun = DateTimeOffset.MinValue;

    public NotificationScheduler(
        IServiceScopeFactory scopes, IConfiguration config, ILogger<NotificationScheduler> log)
    {
        _scopes = scopes;
        _config = config;
        _log = log;
    }

    private TimeZoneInfo Zone
    {
        get
        {
            var id = _config["Hevy:TimeZone"] ?? "Europe/Vienna";
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
        }
    }

    private TimeOnly Slot(string key, TimeOnly fallback) =>
        TimeOnly.TryParseExact(_config[key], "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var at)
            ? at
            : fallback;

    /// <summary>Late enough that the day is over, early enough to still act on it.</summary>
    private TimeOnly EveningCheckAt => Slot("Notifications:EveningCheckAtLocal", new TimeOnly(21, 0));

    /// <summary>Sunday evening: the week reads as finished rather than as about to start.</summary>
    private TimeOnly WeeklyReviewAt => Slot("Notifications:WeeklyReviewAtLocal", new TimeOnly(20, 0));

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(60), ct); }
        catch (OperationCanceledException) { return; }

        // The first pass has no window behind it and only sets the mark: a
        // deploy at 21:03 should not re-send the evening check.
        _lastRun = DateTimeOffset.UtcNow;

        while (!ct.IsCancellationRequested)
        {
            try { await Task.Delay(Tick, ct); }
            catch (OperationCanceledException) { return; }

            var now = DateTimeOffset.UtcNow;
            var from = now - _lastRun > MaxCatchUp ? now - Tick : _lastRun;
            _lastRun = now;

            await RunAsync(from, now, ct);
        }
    }

    /// <summary>Whether a local time of day falls in the window that just passed.</summary>
    private bool Fired(TimeOnly slot, DateTimeOffset from, DateTimeOffset to)
    {
        var zone = Zone;
        var localTo = TimeZoneInfo.ConvertTime(to, zone).DateTime;
        var target = localTo.Date + slot.ToTimeSpan();

        DateTimeOffset utc;
        try
        {
            utc = new DateTimeOffset(
                TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(target, DateTimeKind.Unspecified), zone),
                TimeSpan.Zero);
        }
        catch (ArgumentException)
        {
            // The hour that does not exist on the night the clocks go forward.
            return false;
        }

        return utc > from && utc <= to;
    }

    private async Task RunAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var push = scope.ServiceProvider.GetRequiredService<PushService>();
            if (!push.IsConfigured) return;

            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(to, Zone).DateTime);

            // Only accounts with a device: everything below reads their data,
            // and there is no point doing that for someone who cannot be told.
            var userIds = await db.PushDevices.Select(d => d.UserId).Distinct().ToListAsync(ct);
            if (userIds.Count == 0) return;

            foreach (var userId in userIds)
            {
                await HabitRemindersAsync(db, push, userId, today, from, to, ct);
                await EveningCheckAsync(db, push, userId, today, from, to, ct);
                await WeeklyReviewAsync(db, push, scope, userId, today, from, to, ct);
            }
        }
        catch (Exception exc)
        {
            _log.LogError(exc, "Notification pass failed.");
        }
    }

    /// <summary>
    /// A nudge only for a habit that is due today and has not been ticked. A
    /// reminder about something already done is how a person learns to ignore
    /// the next one.
    /// </summary>
    private async Task HabitRemindersAsync(
        AppDbContext db, PushService push, string userId, DateOnly today,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var habits = await db.Habits
            .Where(h => h.UserId == userId && !h.Archived && h.Schedule != null && h.Schedule.RemindAtLocal != null)
            .Include(h => h.Schedule)
            .ToListAsync(ct);

        foreach (var habit in habits)
        {
            if (!Fired(habit.Schedule!.RemindAtLocal!.Value, from, to)) continue;
            if (!HabitSchedules.IsScheduledOn(habit.Schedule, today)) continue;

            var done = await db.HabitEntries
                .Where(e => e.HabitId == habit.Id && e.Date == today)
                .SumAsync(e => (int?)e.CompletedCount, ct) ?? 0;
            if (done >= habit.Schedule.TargetCount) continue;

            await push.SendAsync(
                userId,
                new PushService.Notification(habit.Name, "Heute noch offen.", "/habits", $"habit-{habit.Id}"),
                ct);
        }
    }

    /// <summary>
    /// One line at the end of a day nothing was written down on. Silent on a
    /// day that already has something in it.
    /// </summary>
    private async Task EveningCheckAsync(
        AppDbContext db, PushService push, string userId, DateOnly today,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        if (!Fired(EveningCheckAt, from, to)) return;

        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        if (!user.NotifyEveningCheck) return;

        var logged =
            await db.NutritionEntries.AnyAsync(e => e.UserId == userId && e.Date == today, ct) ||
            await db.WeightEntries.AnyAsync(e => e.UserId == userId && e.Date == today, ct);
        if (logged) return;

        await push.SendAsync(
            userId,
            new PushService.Notification("Heute noch nichts eingetragen", "Gewicht, Essen, Schlaf.", "/", "evening-check"),
            ct);
    }

    /// <summary>
    /// Sunday evening, with the two numbers that carry the week on the lock
    /// screen and a link to the rest of it.
    /// </summary>
    private async Task WeeklyReviewAsync(
        AppDbContext db, PushService push, IServiceScope scope, string userId, DateOnly today,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        if (today.DayOfWeek != DayOfWeek.Sunday) return;
        if (!Fired(WeeklyReviewAt, from, to)) return;

        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        if (!user.NotifyWeeklyReview) return;

        var review = await scope.ServiceProvider
            .GetRequiredService<WeekReviewService>()
            .BuildAsync(userId, today, ct);

        var sessions = (int)(review.Sessions.Now ?? 0);
        var parts = new List<string> { $"{sessions} {(sessions == 1 ? "Einheit" : "Einheiten")}" };
        if (review.Kcal.Now is double kcal) parts.Add($"{kcal:N0} kcal");
        if (review.RatePerWeekKg is double rate) parts.Add($"{rate:+0.00;-0.00;0.00} kg");

        await push.SendAsync(
            userId,
            new PushService.Notification(
                "Deine Woche",
                string.Join(" · ", parts),
                $"/week?date={review.WeekStart}",
                "weekly-review"),
            ct);
    }
}
