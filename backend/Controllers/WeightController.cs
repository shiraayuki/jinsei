using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/weight")]
[Authorize]
public class WeightController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public WeightController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 90)
    {
        var from = DateOnly.FromDateTime(DateTime.Today.AddDays(-days));
        var entries = await _db.WeightEntries
            .Where(e => e.UserId == UserId && e.Date >= from)
            .OrderByDescending(e => e.Date)
            .ToListAsync();
        return Ok(entries.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertWeightRequest req)
    {
        var existing = await _db.WeightEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == req.Date);

        if (existing is not null)
        {
            existing.WeightKg = req.WeightKg;
            existing.Notes = req.Notes;
            existing.LoggedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            _db.WeightEntries.Add(new WeightEntry
            {
                Id = Guid.NewGuid(),
                UserId = UserId,
                Date = req.Date,
                WeightKg = req.WeightKg,
                Notes = req.Notes,
            });
        }

        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entry = await _db.WeightEntries.FirstOrDefaultAsync(e => e.Id == id && e.UserId == UserId);
        if (entry is null) return NotFound();
        _db.WeightEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static object ToDto(WeightEntry e) => new
    {
        e.Id,
        Date = e.Date.ToString("yyyy-MM-dd"),
        e.WeightKg,
        e.Notes,
        e.LoggedAt,
    };
}

public record UpsertWeightRequest(DateOnly Date, decimal WeightKg, string? Notes);
