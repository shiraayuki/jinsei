using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/nutrition")]
[Authorize]
public class NutritionController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public NutritionController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 30)
    {
        var from = DateOnly.FromDateTime(DateTime.Today.AddDays(-days));
        var entries = await _db.NutritionEntries
            .Where(e => e.UserId == UserId && e.Date >= from)
            .OrderByDescending(e => e.Date)
            .ToListAsync();
        return Ok(entries.Select(ToDto));
    }

    [HttpGet("{date}")]
    public async Task<IActionResult> Get(string date)
    {
        if (!DateOnly.TryParse(date, out var day)) return BadRequest("Invalid date.");
        var entry = await _db.NutritionEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == day);
        return Ok(entry is null ? EmptyDto(day) : ToDto(entry));
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertNutritionRequest req)
    {
        if (req.Kcal is < 0 or > 20000) return BadRequest("Kcal out of range.");
        if (req.ProteinG is < 0 || req.CarbsG is < 0 || req.FatG is < 0 || req.FiberG is < 0)
            return BadRequest("Macros cannot be negative.");
        if (req.WaterL is < 0 or > 30) return BadRequest("Water out of range.");
        if (req.CoffeeMl is < 0 or > 5000) return BadRequest("Coffee out of range.");

        var existing = await _db.NutritionEntries
            .FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == req.Date);

        if (existing is null)
        {
            existing = new NutritionEntry { Id = Guid.NewGuid(), UserId = UserId, Date = req.Date };
            _db.NutritionEntries.Add(existing);
        }

        existing.Kcal = req.Kcal;
        existing.ProteinG = req.ProteinG;
        existing.CarbsG = req.CarbsG;
        existing.FatG = req.FatG;
        existing.FiberG = req.FiberG;
        existing.WaterL = req.WaterL;
        existing.CoffeeMl = req.CoffeeMl;
        existing.LastCoffee = req.LastCoffee;
        existing.Notes = req.Notes;
        existing.LoggedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entry = await _db.NutritionEntries.FirstOrDefaultAsync(e => e.Id == id && e.UserId == UserId);
        if (entry is null) return NotFound();
        _db.NutritionEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static object EmptyDto(DateOnly day) => new
    {
        Id = (Guid?)null,
        Date = day.ToString("yyyy-MM-dd"),
        Kcal = (int?)null,
        ProteinG = (int?)null,
        CarbsG = (int?)null,
        FatG = (int?)null,
        FiberG = (int?)null,
        WaterL = (decimal?)null,
        CoffeeMl = (int?)null,
        LastCoffee = (string?)null,
        Notes = (string?)null,
    };

    private static object ToDto(NutritionEntry e) => new
    {
        Id = (Guid?)e.Id,
        Date = e.Date.ToString("yyyy-MM-dd"),
        e.Kcal,
        e.ProteinG,
        e.CarbsG,
        e.FatG,
        e.FiberG,
        e.WaterL,
        e.CoffeeMl,
        LastCoffee = e.LastCoffee?.ToString("HH:mm"),
        e.Notes,
        e.LoggedAt,
    };
}

public record UpsertNutritionRequest(
    DateOnly Date,
    int? Kcal,
    int? ProteinG,
    int? CarbsG,
    int? FatG,
    int? FiberG,
    decimal? WaterL,
    int? CoffeeMl,
    TimeOnly? LastCoffee,
    string? Notes);
