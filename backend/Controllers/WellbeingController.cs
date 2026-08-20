using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/wellbeing")]
[Authorize]
public class WellbeingController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public WellbeingController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 30)
    {
        var from = DateOnly.FromDateTime(DateTime.Today.AddDays(-days));
        var entries = await _db.WellbeingEntries
            .Where(e => e.UserId == UserId && e.Date >= from)
            .OrderByDescending(e => e.Date)
            .ToListAsync();
        return Ok(entries.Select(ToDto));
    }

    [HttpGet("{date}")]
    public async Task<IActionResult> Get(string date)
    {
        if (!DateOnly.TryParse(date, out var day)) return BadRequest("Invalid date.");
        var entry = await _db.WellbeingEntries.FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == day);
        return Ok(entry is null ? EmptyDto(day) : ToDto(entry));
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertWellbeingRequest req)
    {
        if (req.Hunger is < 1 or > 5) return BadRequest("Hunger must be between 1 and 5.");
        if (req.Energy is < 1 or > 5) return BadRequest("Energy must be between 1 and 5.");

        var existing = await _db.WellbeingEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == req.Date);

        if (existing is null)
        {
            existing = new WellbeingEntry { Id = Guid.NewGuid(), UserId = UserId, Date = req.Date };
            _db.WellbeingEntries.Add(existing);
        }

        existing.Hunger = req.Hunger;
        existing.Energy = req.Energy;
        existing.Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();
        existing.LoggedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static object EmptyDto(DateOnly day) => new
    {
        Id = (Guid?)null,
        Date = day.ToString("yyyy-MM-dd"),
        Hunger = (int?)null,
        Energy = (int?)null,
        Notes = (string?)null,
    };

    private static object ToDto(WellbeingEntry e) => new
    {
        Id = (Guid?)e.Id,
        Date = e.Date.ToString("yyyy-MM-dd"),
        e.Hunger,
        e.Energy,
        e.Notes,
        e.LoggedAt,
    };
}

public record UpsertWellbeingRequest(DateOnly Date, int? Hunger, int? Energy, string? Notes);
