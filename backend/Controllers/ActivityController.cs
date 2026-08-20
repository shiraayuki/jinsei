using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/activity")]
[Authorize]
public class ActivityController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public ActivityController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 30)
    {
        var from = DateOnly.FromDateTime(DateTime.Today.AddDays(-days));
        var entries = await _db.ActivityEntries
            .Where(e => e.UserId == UserId && e.Date >= from)
            .OrderByDescending(e => e.Date)
            .ToListAsync();
        return Ok(entries.Select(ToDto));
    }

    [HttpGet("{date}")]
    public async Task<IActionResult> Get(string date)
    {
        if (!DateOnly.TryParse(date, out var day)) return BadRequest("Invalid date.");
        var entry = await _db.ActivityEntries.FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == day);
        return Ok(entry is null ? EmptyDto(day) : ToDto(entry));
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertActivityRequest req)
    {
        if (req.Steps is < 0 or > 200000) return BadRequest("Steps out of range.");
        if (req.CardioMinutes is < 0 or > 1440) return BadRequest("Cardio minutes out of range.");

        var existing = await _db.ActivityEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == req.Date);

        if (existing is null)
        {
            existing = new ActivityEntry { Id = Guid.NewGuid(), UserId = UserId, Date = req.Date };
            _db.ActivityEntries.Add(existing);
        }

        existing.Steps = req.Steps;
        existing.Cardio = req.Cardio;
        existing.CardioMinutes = req.CardioMinutes;
        existing.LoggedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static object EmptyDto(DateOnly day) => new
    {
        Id = (Guid?)null,
        Date = day.ToString("yyyy-MM-dd"),
        Steps = (int?)null,
        Cardio = (bool?)null,
        CardioMinutes = (int?)null,
    };

    private static object ToDto(ActivityEntry e) => new
    {
        Id = (Guid?)e.Id,
        Date = e.Date.ToString("yyyy-MM-dd"),
        e.Steps,
        e.Cardio,
        e.CardioMinutes,
        e.LoggedAt,
    };
}

public record UpsertActivityRequest(DateOnly Date, int? Steps, bool? Cardio, int? CardioMinutes);
