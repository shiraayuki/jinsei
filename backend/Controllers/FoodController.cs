using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api")]
[Authorize]
public class FoodController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;
    private readonly OpenFoodFactsClient _off;

    public FoodController(AppDbContext db, UserManager<AppUser> users, OpenFoodFactsClient off)
    {
        _db = db;
        _users = users;
        _off = off;
    }

    private string UserId => _users.GetUserId(User)!;

    // GET /api/food/search?q=
    [HttpGet("food/search")]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<FoodItemDto>());

        // First: DB cache results
        var dbResults = await _db.FoodItems
            .Where(f => f.Name.ToLower().Contains(q.ToLower()) || (f.Brand != null && f.Brand.ToLower().Contains(q.ToLower())))
            .OrderByDescending(f => f.CachedAt)
            .Take(10)
            .ToListAsync();

        // Then OFF
        var offResults = await _off.SearchAsync(q);
        var offDtos = offResults.Select(p => new FoodItemDto(
            null, "openfoodfacts", p.Barcode, p.Name, p.Brand,
            p.KcalPer100g, p.ProteinPer100g, p.CarbsPer100g, p.FatPer100g, p.FiberPer100g, p.ServingSizeG
        )).ToList();

        var dbDtos = dbResults.Select(ToDto).ToList();

        // Merge: db first, then OFF results not already in db
        var existing = dbDtos.Select(d => d.ExternalId).ToHashSet();
        var merged = dbDtos
            .Concat(offDtos.Where(d => d.ExternalId == null || !existing.Contains(d.ExternalId)))
            .Take(20)
            .ToList();

        return Ok(merged);
    }

    // GET /api/food/barcode/{code}
    [HttpGet("food/barcode/{code}")]
    public async Task<IActionResult> GetByBarcode(string code)
    {
        var db = await _db.FoodItems.FirstOrDefaultAsync(f => f.Barcode == code);
        if (db is not null) return Ok(ToDto(db));

        var product = await _off.GetByBarcodeAsync(code);
        if (product is null) return NotFound();

        return Ok(new FoodItemDto(
            null, "openfoodfacts", product.Barcode, product.Name, product.Brand,
            product.KcalPer100g, product.ProteinPer100g, product.CarbsPer100g, product.FatPer100g,
            product.FiberPer100g, product.ServingSizeG
        ));
    }

    // POST /api/food/items — cache an OFF item or create custom
    [HttpPost("food/items")]
    public async Task<IActionResult> SaveItem([FromBody] SaveFoodItemRequest req)
    {
        // If OFF item already cached, return it
        if (req.Source == "openfoodfacts" && req.ExternalId != null)
        {
            var existing = await _db.FoodItems
                .FirstOrDefaultAsync(f => f.Source == "openfoodfacts" && f.Barcode == req.ExternalId);
            if (existing is not null) return Ok(ToDto(existing));
        }

        var item = new FoodItem
        {
            Id = Guid.NewGuid(),
            Source = req.Source,
            ExternalId = req.ExternalId,
            Barcode = req.ExternalId,
            Name = req.Name,
            Brand = req.Brand,
            KcalPer100g = req.KcalPer100g,
            ProteinPer100g = req.ProteinPer100g,
            CarbsPer100g = req.CarbsPer100g,
            FatPer100g = req.FatPer100g,
            FiberPer100g = req.FiberPer100g,
            ServingSizeG = req.ServingSizeG,
            CachedAt = DateTimeOffset.UtcNow,
        };

        _db.FoodItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    // GET /api/meals?date=
    [HttpGet("meals")]
    public async Task<IActionResult> GetMeals([FromQuery] DateOnly? date)
    {
        var d = date ?? DateOnly.FromDateTime(DateTime.Today);
        var entries = await _db.MealEntries
            .Include(m => m.FoodItem)
            .Where(m => m.UserId == UserId && m.Date == d)
            .OrderBy(m => m.LoggedAt)
            .ToListAsync();

        return Ok(entries.Select(ToMealDto));
    }

    // GET /api/meals/summary?date=
    [HttpGet("meals/summary")]
    public async Task<IActionResult> GetSummary([FromQuery] DateOnly? date)
    {
        var d = date ?? DateOnly.FromDateTime(DateTime.Today);
        var entries = await _db.MealEntries
            .Include(m => m.FoodItem)
            .Where(m => m.UserId == UserId && m.Date == d)
            .ToListAsync();

        decimal Calc(Func<FoodItem, decimal> fn) =>
            entries.Sum(e => fn(e.FoodItem) * e.Grams / 100m);

        return Ok(new MacroSummaryDto(
            Math.Round(Calc(f => f.KcalPer100g)),
            Math.Round(Calc(f => f.ProteinPer100g), 1),
            Math.Round(Calc(f => f.CarbsPer100g), 1),
            Math.Round(Calc(f => f.FatPer100g), 1)
        ));
    }

    // POST /api/meals
    [HttpPost("meals")]
    public async Task<IActionResult> LogMeal([FromBody] LogMealRequest req)
    {
        var entry = new MealEntry
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Date = req.Date,
            MealType = req.MealType,
            FoodItemId = req.FoodItemId,
            Grams = req.Grams,
        };

        _db.MealEntries.Add(entry);
        await _db.SaveChangesAsync();

        var loaded = await _db.MealEntries
            .Include(m => m.FoodItem)
            .FirstAsync(m => m.Id == entry.Id);

        return Ok(ToMealDto(loaded));
    }

    // PUT /api/meals/{id}
    [HttpPut("meals/{id:guid}")]
    public async Task<IActionResult> UpdateMeal(Guid id, [FromBody] LogMealRequest req)
    {
        var entry = await _db.MealEntries.FirstOrDefaultAsync(m => m.Id == id && m.UserId == UserId);
        if (entry is null) return NotFound();

        entry.Grams = req.Grams;
        entry.MealType = req.MealType;
        entry.LoggedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        var loaded = await _db.MealEntries.Include(m => m.FoodItem).FirstAsync(m => m.Id == id);
        return Ok(ToMealDto(loaded));
    }

    // DELETE /api/meals/{id}
    [HttpDelete("meals/{id:guid}")]
    public async Task<IActionResult> DeleteMeal(Guid id)
    {
        var entry = await _db.MealEntries.FirstOrDefaultAsync(m => m.Id == id && m.UserId == UserId);
        if (entry is null) return NotFound();
        _db.MealEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static FoodItemDto ToDto(FoodItem f) => new(
        f.Id, f.Source, f.Barcode, f.Name, f.Brand,
        f.KcalPer100g, f.ProteinPer100g, f.CarbsPer100g, f.FatPer100g, f.FiberPer100g, f.ServingSizeG
    );

    private static MealEntryDto ToMealDto(MealEntry m)
    {
        var kcal = Math.Round(m.FoodItem.KcalPer100g * m.Grams / 100m);
        var protein = Math.Round(m.FoodItem.ProteinPer100g * m.Grams / 100m, 1);
        return new MealEntryDto(
            m.Id, m.Date, m.MealType, m.Grams,
            ToDto(m.FoodItem), kcal, protein, m.LoggedAt
        );
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────

public record FoodItemDto(
    Guid? Id,
    string Source,
    string? ExternalId,
    string Name,
    string? Brand,
    decimal KcalPer100g,
    decimal ProteinPer100g,
    decimal CarbsPer100g,
    decimal FatPer100g,
    decimal? FiberPer100g,
    decimal? ServingSizeG
);

public record MealEntryDto(
    Guid Id,
    DateOnly Date,
    string MealType,
    decimal Grams,
    FoodItemDto FoodItem,
    decimal Kcal,
    decimal Protein,
    DateTimeOffset LoggedAt
);

public record MacroSummaryDto(decimal Kcal, decimal Protein, decimal Carbs, decimal Fat);

public record SaveFoodItemRequest(
    string Source,
    string? ExternalId,
    string Name,
    string? Brand,
    decimal KcalPer100g,
    decimal ProteinPer100g,
    decimal CarbsPer100g,
    decimal FatPer100g,
    decimal? FiberPer100g,
    decimal? ServingSizeG
);

public record LogMealRequest(DateOnly Date, string MealType, Guid FoodItemId, decimal Grams);
