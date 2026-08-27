using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/sleep")]
[Authorize]
public class SleepController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public SleepController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 30)
    {
        var from = DateOnly.FromDateTime(DateTime.Today.AddDays(-days));
        var entries = await _db.SleepEntries
            .Where(e => e.UserId == UserId && e.Date >= from)
            .OrderByDescending(e => e.Date)
            .ToListAsync();
        return Ok(entries.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertSleepRequest req)
    {
        if (req.TimeInBedMinutes is < 0 or > 1440 || req.ActualSleepMinutes is < 0 or > 1440)
            return BadRequest("Durations must be between 0 and 1440 minutes.");
        if (new[] { req.AwakeMinutes, req.LightMinutes, req.RemMinutes, req.DeepMinutes }
            .Any(m => m is < 0 or > 1440))
            return BadRequest("Phase durations must be between 0 and 1440 minutes.");
        if (req.SleepOnsetMinutes is < 0 or > 1440)
            return BadRequest("Sleep onset must be between 0 and 1440 minutes.");
        // Checked against what will actually be stored, which is the duration
        // worked out from the phases when none was sent.
        if ((req.ActualSleepMinutes ?? Asleep(req)) is int asleep
            && (req.TimeInBedMinutes ?? SpanBetween(req.BedTime, req.WakeTime)) is int inBed
            && asleep > inBed)
            return BadRequest("Actual sleep cannot exceed time in bed.");

        var existing = await _db.SleepEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == req.Date);

        if (existing is null)
        {
            existing = new SleepEntry { Id = Guid.NewGuid(), UserId = UserId, Date = req.Date };
            _db.SleepEntries.Add(existing);
        }

        // Two clock times already say how long the night was, so the duration
        // is filled in from them when it was not sent — a night entered by its
        // times should not also have to be entered by its length.
        existing.TimeInBedMinutes = req.TimeInBedMinutes
            ?? SpanBetween(req.BedTime, req.WakeTime);
        existing.BedTime = req.BedTime;
        existing.WakeTime = req.WakeTime;
        existing.AwakeMinutes = req.AwakeMinutes;
        existing.LightMinutes = req.LightMinutes;
        existing.RemMinutes = req.RemMinutes;
        existing.DeepMinutes = req.DeepMinutes;
        existing.SleepOnsetMinutes = req.SleepOnsetMinutes;
        // The phases already say how long was slept, so the duration is filled
        // in from them the same way the clock times fill in the time in bed. A
        // duration that was sent outright still wins.
        existing.ActualSleepMinutes = req.ActualSleepMinutes ?? Asleep(req);
        existing.Notes = req.Notes;
        existing.LoggedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Light, REM and deep add up to the sleep itself. Awake is deliberately
    /// left out: it is time in bed, not time asleep.
    /// </summary>
    private static int? Asleep(UpsertSleepRequest req)
    {
        var phases = new[] { req.LightMinutes, req.RemMinutes, req.DeepMinutes };
        return phases.Any(m => m is not null) ? phases.Sum(m => m ?? 0) : null;
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entry = await _db.SleepEntries.FirstOrDefaultAsync(e => e.Id == id && e.UserId == UserId);
        if (entry is null) return NotFound();
        _db.SleepEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Minutes from one clock time to the other, wrapping over midnight: going
    /// to bed at 22:30 and getting up at 07:30 is nine hours, not minus fifteen.
    /// </summary>
    private static int? SpanBetween(TimeOnly? from, TimeOnly? to)
    {
        if (from is not TimeOnly start || to is not TimeOnly end) return null;
        var minutes = (int)(end - start).TotalMinutes;
        if (minutes <= 0) minutes += 24 * 60;
        return minutes;
    }

    private static object ToDto(SleepEntry e) => new
    {
        e.Id,
        Date = e.Date.ToString("yyyy-MM-dd"),
        e.TimeInBedMinutes,
        e.ActualSleepMinutes,
        e.AwakeMinutes,
        e.LightMinutes,
        e.RemMinutes,
        e.DeepMinutes,
        e.SleepOnsetMinutes,
        BedTime = e.BedTime?.ToString("HH:mm"),
        WakeTime = e.WakeTime?.ToString("HH:mm"),
        // Share of the time in bed actually spent asleep — the number Sleep
        // Cycle calls efficiency.
        Efficiency = e.TimeInBedMinutes is > 0 && e.ActualSleepMinutes is not null
            ? (int)Math.Round(e.ActualSleepMinutes.Value * 100.0 / e.TimeInBedMinutes.Value)
            : (int?)null,
        e.Notes,
        e.LoggedAt,
    };
}

public record UpsertSleepRequest(
    DateOnly Date,
    int? TimeInBedMinutes,
    int? ActualSleepMinutes,
    int? AwakeMinutes,
    int? LightMinutes,
    int? RemMinutes,
    int? DeepMinutes,
    int? SleepOnsetMinutes,
    TimeOnly? BedTime,
    TimeOnly? WakeTime,
    string? Notes);
