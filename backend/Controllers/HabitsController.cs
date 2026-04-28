using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/habits")]
[Authorize]
public class HabitsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public HabitsController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    // GET /api/habits
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var habits = await _db.Habits
            .Include(h => h.Schedule)
            .Include(h => h.Entries.OrderByDescending(e => e.Date).Take(90))
            .Where(h => h.UserId == UserId && !h.Archived)
            .OrderBy(h => h.CreatedAt)
            .ToListAsync();

        return Ok(habits.Select(h => ToDto(h, today)));
    }

    // POST /api/habits
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertHabitRequest req)
    {
        var habit = new Habit
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Name = req.Name,
            Description = req.Description,
            Color = req.Color ?? "#6366f1",
            Icon = req.Icon,
            Schedule = new HabitSchedule
            {
                ScheduleType = Enum.Parse<ScheduleType>(req.Schedule.Type, ignoreCase: true),
                TargetCount = req.Schedule.TargetCount,
                DaysOfWeek = req.Schedule.DaysOfWeek,
                IntervalDays = req.Schedule.IntervalDays,
                ActiveFrom = DateOnly.FromDateTime(DateTime.Today),
            },
        };

        _db.Habits.Add(habit);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(List), ToDto(habit, DateOnly.FromDateTime(DateTime.Today)));
    }

    // PUT /api/habits/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertHabitRequest req)
    {
        var habit = await _db.Habits
            .Include(h => h.Schedule)
            .FirstOrDefaultAsync(h => h.Id == id && h.UserId == UserId);

        if (habit is null) return NotFound();

        habit.Name = req.Name;
        habit.Description = req.Description;
        habit.Color = req.Color ?? habit.Color;
        habit.Icon = req.Icon;

        if (habit.Schedule is not null)
        {
            habit.Schedule.ScheduleType = Enum.Parse<ScheduleType>(req.Schedule.Type, ignoreCase: true);
            habit.Schedule.TargetCount = req.Schedule.TargetCount;
            habit.Schedule.DaysOfWeek = req.Schedule.DaysOfWeek;
            habit.Schedule.IntervalDays = req.Schedule.IntervalDays;
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(habit, DateOnly.FromDateTime(DateTime.Today)));
    }

    // DELETE /api/habits/{id}  (soft archive)
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Archive(Guid id)
    {
        var habit = await _db.Habits.FirstOrDefaultAsync(h => h.Id == id && h.UserId == UserId);
        if (habit is null) return NotFound();
        habit.Archived = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET /api/habits/{id}/entries
    [HttpGet("{id:guid}/entries")]
    public async Task<IActionResult> GetEntries(Guid id, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var exists = await _db.Habits.AnyAsync(h => h.Id == id && h.UserId == UserId);
        if (!exists) return NotFound();

        var query = _db.HabitEntries.Where(e => e.HabitId == id);
        if (from.HasValue) query = query.Where(e => e.Date >= from.Value);
        if (to.HasValue) query = query.Where(e => e.Date <= to.Value);

        var entries = await query.OrderByDescending(e => e.Date).ToListAsync();
        return Ok(entries.Select(ToEntryDto));
    }

    // POST /api/habits/{id}/entries
    [HttpPost("{id:guid}/entries")]
    public async Task<IActionResult> LogEntry(Guid id, [FromBody] LogEntryRequest req)
    {
        var exists = await _db.Habits.AnyAsync(h => h.Id == id && h.UserId == UserId);
        if (!exists) return NotFound();

        // Upsert: one entry per date
        var existing = await _db.HabitEntries
            .FirstOrDefaultAsync(e => e.HabitId == id && e.Date == req.Date);

        if (existing is not null)
        {
            existing.CompletedCount = req.CompletedCount;
            existing.Notes = req.Notes;
            existing.LoggedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            _db.HabitEntries.Add(new HabitEntry
            {
                Id = Guid.NewGuid(),
                HabitId = id,
                Date = req.Date,
                CompletedCount = req.CompletedCount,
                Notes = req.Notes,
            });
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    // DELETE /api/habits/entries/{entryId}
    [HttpDelete("entries/{entryId:guid}")]
    public async Task<IActionResult> DeleteEntry(Guid entryId)
    {
        var entry = await _db.HabitEntries
            .Include(e => e.Habit)
            .FirstOrDefaultAsync(e => e.Id == entryId && e.Habit.UserId == UserId);

        if (entry is null) return NotFound();
        _db.HabitEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private static HabitDto ToDto(Habit habit, DateOnly today)
    {
        var entries = habit.Entries?.ToList() ?? [];
        var schedule = habit.Schedule;
        var completedToday = entries.Any(e => e.Date == today && e.CompletedCount > 0);
        var streak = schedule is null ? 0 : CalcStreak(schedule, entries, today);

        return new HabitDto(
            habit.Id,
            habit.Name,
            habit.Description,
            habit.Color,
            habit.Icon,
            schedule is null ? null : new ScheduleDto(
                schedule.ScheduleType.ToString().ToLower(),
                schedule.TargetCount,
                schedule.DaysOfWeek,
                schedule.IntervalDays,
                schedule.ActiveFrom
            ),
            habit.Archived,
            habit.CreatedAt,
            completedToday,
            streak
        );
    }

    private static int CalcStreak(HabitSchedule schedule, List<HabitEntry> entries, DateOnly today)
    {
        var done = entries
            .Where(e => e.CompletedCount >= schedule.TargetCount)
            .Select(e => e.Date)
            .ToHashSet();

        if (done.Count == 0) return 0;

        return schedule.ScheduleType switch
        {
            ScheduleType.Daily => CountDailyStreak(done, today),
            ScheduleType.Weekly when schedule.DaysOfWeek is { Length: > 0 } =>
                CountScheduledDaysStreak(done, schedule.DaysOfWeek, today),
            ScheduleType.Interval when schedule.IntervalDays is > 0 =>
                CountIntervalStreak(done, schedule.IntervalDays.Value, today, schedule.ActiveFrom),
            _ => done.Count,
        };
    }

    private static int CountDailyStreak(HashSet<DateOnly> done, DateOnly today)
    {
        var streak = 0;
        var day = done.Contains(today) ? today : today.AddDays(-1);
        while (done.Contains(day))
        {
            streak++;
            day = day.AddDays(-1);
        }
        return streak;
    }

    private static int CountScheduledDaysStreak(HashSet<DateOnly> done, int[] days, DateOnly today)
    {
        var streak = 0;
        var day = today;
        // Skip today if not a scheduled day
        while (!days.Contains((int)day.DayOfWeek) && day > today.AddDays(-7))
            day = day.AddDays(-1);

        while (true)
        {
            if (days.Contains((int)day.DayOfWeek))
            {
                if (!done.Contains(day)) break;
                streak++;
            }
            day = day.AddDays(-1);
            if (day < today.AddDays(-365)) break;
        }
        return streak;
    }

    private static int CountIntervalStreak(HashSet<DateOnly> done, int interval, DateOnly today, DateOnly activeFrom)
    {
        var streak = 0;
        var day = today;
        while (day >= activeFrom)
        {
            if (done.Contains(day))
            {
                streak++;
                day = day.AddDays(-interval);
            }
            else break;
        }
        return streak;
    }

    private static HabitEntryDto ToEntryDto(HabitEntry e) =>
        new(e.Id, e.Date, e.CompletedCount, e.Notes, e.LoggedAt);
}

// ── DTOs / Request records ────────────────────────────────────────────────

public record HabitDto(
    Guid Id,
    string Name,
    string? Description,
    string Color,
    string? Icon,
    ScheduleDto? Schedule,
    bool Archived,
    DateTimeOffset CreatedAt,
    bool CompletedToday,
    int Streak
);

public record ScheduleDto(
    string Type,
    int TargetCount,
    int[]? DaysOfWeek,
    int? IntervalDays,
    DateOnly ActiveFrom
);

public record UpsertHabitRequest(
    string Name,
    string? Description,
    string? Color,
    string? Icon,
    ScheduleDto Schedule
);

public record LogEntryRequest(DateOnly Date, int CompletedCount, string? Notes);

public record HabitEntryDto(
    Guid Id,
    DateOnly Date,
    int CompletedCount,
    string? Notes,
    DateTimeOffset LoggedAt
);
