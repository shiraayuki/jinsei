using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// The one door into the app that is not a browser session: a phone shortcut
/// posting what Apple Health already knows, so the numbers stop being typed in
/// by hand. It authenticates with the ingest token from the profile, never with
/// a cookie, and it only ever writes the days it was given.
///
/// Every endpoint here follows the same two rules: a field that was left out is
/// left alone, and nothing that is only ever entered by hand — the cardio
/// answer, sleep quality, notes — is touched at all. The endpoints are separate
/// on purpose, so a sync that breaks on one source does not take the others
/// down with it.
/// </summary>
[ApiController]
[Route("api/ingest")]
public class IngestController : ControllerBase
{
    private readonly AppDbContext _db;

    public IngestController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Upserts step counts for whole days. Sending a day again replaces its
    /// count, so a shortcut that runs hourly and a shortcut that backfills a
    /// fortnight both end up with one row per day.
    /// </summary>
    [HttpPost("activity")]
    public async Task<IActionResult> Activity([FromBody] IngestActivityRequest req, CancellationToken ct)
    {
        // Who before what: an unauthenticated caller learns nothing about the
        // shape this endpoint expects.
        var user = await ResolveUserAsync(ct);
        if (user is null) return Unauthorized(new { message = "Unknown or missing ingest token." });

        if (req.Entries is null or { Count: 0 }) return BadRequest(new { message = "No entries." });
        if (req.Entries.Count > 400) return BadRequest(new { message = "Too many entries in one request." });

        var days = req.Entries.Select(e => e.Date).Distinct().ToList();
        var existing = await _db.ActivityEntries
            .Where(a => a.UserId == user.Id && days.Contains(a.Date))
            .ToDictionaryAsync(a => a.Date, ct);

        var written = 0;
        foreach (var entry in req.Entries)
        {
            if (entry.Steps is < 0 or > 200_000) continue;

            if (!existing.TryGetValue(entry.Date, out var row))
            {
                row = new ActivityEntry { Id = Guid.NewGuid(), UserId = user.Id, Date = entry.Date };
                _db.ActivityEntries.Add(row);
                existing[entry.Date] = row;
            }

            // Steps are the only field this touches: whether the day had cardio
            // is an answer given by hand, and a step count is no reason to
            // overwrite it.
            row.Steps = entry.Steps;
            row.LoggedAt = DateTimeOffset.UtcNow;
            written++;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { written, days = days.Count });
    }

    /// <summary>
    /// Upserts the nutrition totals FatSecret writes into Apple Health. Only
    /// the fields present in the request are written: sending calories alone
    /// leaves water, coffee and the notes of that day standing. Clearing a
    /// value stays a job for the app — null here means "no reading", not "zero".
    /// </summary>
    [HttpPost("nutrition")]
    public async Task<IActionResult> Nutrition([FromBody] IngestNutritionRequest req, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user is null) return Unauthorized(new { message = "Unknown or missing ingest token." });

        if (req.Entries is null or { Count: 0 }) return BadRequest(new { message = "No entries." });
        if (req.Entries.Count > 400) return BadRequest(new { message = "Too many entries in one request." });

        var days = req.Entries.Select(e => e.Date).Distinct().ToList();
        var existing = await _db.NutritionEntries
            .Where(n => n.UserId == user.Id && days.Contains(n.Date))
            .ToDictionaryAsync(n => n.Date, ct);

        var written = 0;
        foreach (var entry in req.Entries)
        {
            // A day whose every reading was implausible is not worth a row.
            var kcal = InRange(entry.Kcal, 0, 20_000);
            var protein = InRange(entry.ProteinG, 0, 1_000);
            var carbs = InRange(entry.CarbsG, 0, 2_000);
            var fat = InRange(entry.FatG, 0, 1_000);
            var fiber = InRange(entry.FiberG, 0, 500);
            var water = InRange(entry.WaterL, 0m, 30m);
            if (kcal is null && protein is null && carbs is null && fat is null && fiber is null && water is null)
                continue;

            if (!existing.TryGetValue(entry.Date, out var row))
            {
                row = new NutritionEntry { Id = Guid.NewGuid(), UserId = user.Id, Date = entry.Date };
                _db.NutritionEntries.Add(row);
                existing[entry.Date] = row;
            }

            row.Kcal = kcal ?? row.Kcal;
            row.ProteinG = protein ?? row.ProteinG;
            row.CarbsG = carbs ?? row.CarbsG;
            row.FatG = fat ?? row.FatG;
            row.FiberG = fiber ?? row.FiberG;
            // Water is in Health too, but only when it was logged there; a day
            // without it must not wipe what was tapped into the app.
            row.WaterL = water ?? row.WaterL;
            row.LoggedAt = DateTimeOffset.UtcNow;
            written++;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { written, days = days.Count });
    }

    /// <summary>The reading, or null when it is missing or outside what a day can hold.</summary>
    private static int? InRange(int? value, int min, int max) =>
        value is null || value < min || value > max ? null : value;

    private static decimal? InRange(decimal? value, decimal min, decimal max) =>
        value is null || value < min || value > max ? null : value;

    /// <summary>The user whose token was presented, or null.</summary>
    private async Task<AppUser?> ResolveUserAsync(CancellationToken ct)
    {
        var token = Request.Headers["X-Ingest-Token"].ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            // Shortcuts is happier with an Authorization header than a custom
            // one, so both are accepted.
            var auth = Request.Headers.Authorization.ToString();
            if (auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                token = auth[7..].Trim();
        }
        if (string.IsNullOrWhiteSpace(token)) return null;

        var hash = IngestTokens.Hash(token);
        return await _db.Users.FirstOrDefaultAsync(u => u.IngestTokenHash == hash, ct);
    }
}

public record IngestActivityEntry(DateOnly Date, int? Steps);

public record IngestActivityRequest(List<IngestActivityEntry> Entries);

public record IngestNutritionEntry(
    DateOnly Date,
    int? Kcal,
    int? ProteinG,
    int? CarbsG,
    int? FatG,
    int? FiberG,
    decimal? WaterL);

public record IngestNutritionRequest(List<IngestNutritionEntry> Entries);
