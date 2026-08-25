using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// The one door into the app that is not a browser session: a phone shortcut
/// posting what Apple Health already knows, so steps stop being typed in by
/// hand. It authenticates with the ingest token from the profile, never with a
/// cookie, and it only ever writes the days it was given.
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
        if (req.Entries is null or { Count: 0 }) return BadRequest(new { message = "No entries." });
        if (req.Entries.Count > 400) return BadRequest(new { message = "Too many entries in one request." });

        var user = await ResolveUserAsync(ct);
        if (user is null) return Unauthorized(new { message = "Unknown or missing ingest token." });

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
