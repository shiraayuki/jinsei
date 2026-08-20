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
        if (req.WeightKg is null && req.WaistCm is null)
            return BadRequest("Provide a weight, a waist measurement, or both.");
        if (req.WeightKg is < 20 or > 400) return BadRequest("Weight out of range.");
        if (req.WaistCm is < 30 or > 250) return BadRequest("Waist out of range.");

        var existing = await _db.WeightEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == req.Date);

        if (existing is null)
        {
            existing = new WeightEntry { Id = Guid.NewGuid(), UserId = UserId, Date = req.Date };
            _db.WeightEntries.Add(existing);
        }

        existing.WeightKg = req.WeightKg;
        existing.WaistCm = req.WaistCm;
        existing.Notes = req.Notes;
        existing.LoggedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
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
        e.WaistCm,
        e.Notes,
        e.LoggedAt,
    };
}

public record UpsertWeightRequest(DateOnly Date, decimal? WeightKg, decimal? WaistCm, string? Notes);
