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
        if (req.Quality < 1 || req.Quality > 5)
            return BadRequest("Quality must be 1–5.");

        var existing = await _db.SleepEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == req.Date);

        if (existing is not null)
        {
            existing.BedTime = req.BedTime;
            existing.WakeTime = req.WakeTime;
            existing.Quality = req.Quality;
            existing.Notes = req.Notes;
            existing.LoggedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            _db.SleepEntries.Add(new SleepEntry
            {
                Id = Guid.NewGuid(),
                UserId = UserId,
                Date = req.Date,
                BedTime = req.BedTime,
                WakeTime = req.WakeTime,
                Quality = req.Quality,
                Notes = req.Notes,
            });
        }

        await _db.SaveChangesAsync();
        return Ok();
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

    private static object ToDto(SleepEntry e)
    {
        var bedMinutes = e.BedTime.Hour * 60 + e.BedTime.Minute;
        var wakeMinutes = e.WakeTime.Hour * 60 + e.WakeTime.Minute;
        var durationMinutes = wakeMinutes >= bedMinutes
            ? wakeMinutes - bedMinutes
            : 1440 - bedMinutes + wakeMinutes;

        return new
        {
            e.Id,
            Date = e.Date.ToString("yyyy-MM-dd"),
            BedTime = e.BedTime.ToString("HH:mm"),
            WakeTime = e.WakeTime.ToString("HH:mm"),
            DurationMinutes = durationMinutes,
            e.Quality,
            e.Notes,
            e.LoggedAt,
        };
    }
}

public record UpsertSleepRequest(DateOnly Date, TimeOnly BedTime, TimeOnly WakeTime, int Quality, string? Notes);
