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
        if (req.Quality is < 0 or > 100)
            return BadRequest("Quality must be between 0 and 100.");
        if (req.TimeInBedMinutes is < 0 or > 1440 || req.ActualSleepMinutes is < 0 or > 1440)
            return BadRequest("Durations must be between 0 and 1440 minutes.");
        if (req.ActualSleepMinutes is int asleep && req.TimeInBedMinutes is int inBed && asleep > inBed)
            return BadRequest("Actual sleep cannot exceed time in bed.");

        var existing = await _db.SleepEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == req.Date);

        if (existing is null)
        {
            existing = new SleepEntry { Id = Guid.NewGuid(), UserId = UserId, Date = req.Date };
            _db.SleepEntries.Add(existing);
        }

        existing.TimeInBedMinutes = req.TimeInBedMinutes;
        existing.ActualSleepMinutes = req.ActualSleepMinutes;
        existing.Quality = req.Quality;
        existing.Notes = req.Notes;
        existing.LoggedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
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

    private static object ToDto(SleepEntry e) => new
    {
        e.Id,
        Date = e.Date.ToString("yyyy-MM-dd"),
        e.TimeInBedMinutes,
        e.ActualSleepMinutes,
        e.Quality,
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
    int? Quality,
    string? Notes);
