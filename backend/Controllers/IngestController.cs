using System.Globalization;
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

        // The scheduled Hevy sync fills the cardio answer on the same one row
        // per day, and both run in the evening. Two writers that both find no
        // row insert two, and the unique index on (user, date) rejects the
        // second — so a failed write reads the day again, where the row that
        // appeared in between is an update rather than an insert.
        for (var attempt = 0; ; attempt++)
        {
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

                // Steps are the only field this touches: whether the day had
                // cardio is an answer given by hand, and a step count is no
                // reason to overwrite it.
                row.Steps = entry.Steps;
                row.LoggedAt = DateTimeOffset.UtcNow;
                written++;
            }

            try
            {
                await _db.SaveChangesAsync(ct);
                return Ok(new { written, days = days.Count });
            }
            catch (DbUpdateException) when (attempt == 0)
            {
                foreach (var tracked in _db.ChangeTracker.Entries<ActivityEntry>().ToList())
                    tracked.State = EntityState.Detached;
            }
        }
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
            var water = InRange(entry.WaterL, 0m, 30m);
            if (kcal is null && protein is null && carbs is null && fat is null && water is null)
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

    /// <summary>
    /// Upserts a night from its two clock times. Health holds "in bed" as one
    /// interval per night, so the shortcut can hand over that interval's start
    /// and end untouched — as full timestamps, which is what Shortcuts produces
    /// without a formatting step, or as plain "HH:mm" when it has already been
    /// formatted.
    ///
    /// Quality is never written here: Sleep Cycle does not put its percentage
    /// into Health, so that number stays with the hand or the screenshot.
    /// </summary>
    [HttpPost("sleep")]
    public async Task<IActionResult> Sleep([FromBody] IngestSleepRequest req, CancellationToken ct)
    {
        var user = await ResolveUserAsync(ct);
        if (user is null) return Unauthorized(new { message = "Unknown or missing ingest token." });

        if (req.Entries is null or { Count: 0 }) return BadRequest(new { message = "No entries." });
        if (req.Entries.Count > 400) return BadRequest(new { message = "Too many entries in one request." });

        var parsed = new List<(DateOnly Date, TimeOnly? Bed, TimeOnly? Wake, int? InBed, bool Measured, int? Asleep)>();
        var skipped = new List<object>();

        foreach (var entry in req.Entries)
        {
            var bed = ReadClock(entry.BedTime);
            var wake = ReadClock(entry.WakeTime);

            // The night belongs to the morning it ended on, which the wake
            // timestamp already carries. Only a request that sends neither a
            // date nor a full wake timestamp has nothing to file the night under.
            var date = entry.Date ?? ReadDate(entry.WakeTime);
            if (date is null)
            {
                skipped.Add(new { bedTime = entry.BedTime, wakeTime = entry.WakeTime, reason = "no date" });
                continue;
            }

            var span = entry.TimeInBedMinutes ?? SpanBetween(bed, wake);

            // The failure this guards against is real: a shortcut that formats
            // a timestamp without a time part sends midnight for both ends, and
            // midnight to midnight looks like a flawless 24-hour night. A night
            // outside 1–16 hours is a broken reading, not a long lie-in.
            if (span is < 60 or > 16 * 60)
            {
                skipped.Add(new { date = date.Value.ToString("yyyy-MM-dd"), bedTime = entry.BedTime, wakeTime = entry.WakeTime, reason = "implausible night" });
                continue;
            }

            var asleep = entry.ActualSleepMinutes;
            if (asleep is < 0 or > 16 * 60) asleep = null;
            if (asleep is int a && span is int s && a > s) asleep = span;

            parsed.Add((date.Value, bed, wake, span, entry.TimeInBedMinutes is not null, asleep));
        }

        var days = parsed.Select(p => p.Date).Distinct().ToList();
        var existing = await _db.SleepEntries
            .Where(x => x.UserId == user.Id && days.Contains(x.Date))
            .ToDictionaryAsync(x => x.Date, ct);

        var written = 0;
        foreach (var night in parsed)
        {
            if (!existing.TryGetValue(night.Date, out var row))
            {
                row = new SleepEntry { Id = Guid.NewGuid(), UserId = user.Id, Date = night.Date };
                _db.SleepEntries.Add(row);
                existing[night.Date] = row;
            }

            row.BedTime = night.Bed ?? row.BedTime;
            row.WakeTime = night.Wake ?? row.WakeTime;
            // A duration already on the row was measured by Sleep Cycle and is
            // the better number, so a span worked out from two clock times only
            // fills a gap. A duration sent outright is a measurement too, and
            // wins.
            row.TimeInBedMinutes = night.Measured ? night.InBed : row.TimeInBedMinutes ?? night.InBed;
            row.ActualSleepMinutes = night.Asleep ?? row.ActualSleepMinutes;
            row.LoggedAt = DateTimeOffset.UtcNow;
            written++;
        }

        await _db.SaveChangesAsync(ct);

        // The nights are echoed back because this is the endpoint that is
        // hardest to get right from a phone: reading 20:15 in the answer is how
        // you find out the shortcut sent the interval and not midnight.
        return Ok(new
        {
            written,
            days = days.Count,
            skipped,
            nights = parsed.Select(p => new
            {
                date = p.Date.ToString("yyyy-MM-dd"),
                bedTime = p.Bed?.ToString("HH:mm"),
                wakeTime = p.Wake?.ToString("HH:mm"),
                timeInBedMinutes = p.InBed,
                actualSleepMinutes = p.Asleep,
            }),
        });
    }

    /// <summary>
    /// The time of day out of what the phone sent: "22:15", "22:15:30" or a
    /// whole timestamp such as "2026-08-24T22:15:00+02:00". A timestamp keeps
    /// its own offset, because the clock time that matters is the one on the
    /// bedroom wall, not the same instant in UTC.
    /// </summary>
    private static TimeOnly? ReadClock(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = value.Trim();

        if (TimeOnly.TryParseExact(text, ["HH:mm", "H:mm", "HH:mm:ss"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return time;

        return ReadTimestamp(text) is DateTimeOffset stamp ? TimeOnly.FromDateTime(stamp.DateTime) : null;
    }

    /// <summary>The calendar day out of a whole timestamp, or null for a bare clock time.</summary>
    private static DateOnly? ReadDate(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null
        : ReadTimestamp(value.Trim()) is DateTimeOffset stamp ? DateOnly.FromDateTime(stamp.DateTime)
        : null;

    private static DateTimeOffset? ReadTimestamp(string text) =>
        DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var stamp)
            ? stamp
            : null;

    /// <summary>
    /// Minutes from one clock time to the other, wrapping over midnight, the
    /// same way the hand-entry path does it.
    /// </summary>
    private static int? SpanBetween(TimeOnly? from, TimeOnly? to)
    {
        if (from is not TimeOnly start || to is not TimeOnly end) return null;
        var minutes = (int)(end - start).TotalMinutes;
        if (minutes <= 0) minutes += 24 * 60;
        return minutes;
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

public record IngestNutritionEntry(
    DateOnly Date,
    int? Kcal,
    int? ProteinG,
    int? CarbsG,
    int? FatG,
    decimal? WaterL);

public record IngestNutritionRequest(List<IngestNutritionEntry> Entries);

/// <summary>
/// A night. The times are strings rather than <see cref="TimeOnly"/> because a
/// phone sends whatever its formatting step produced, and the endpoint would
/// rather read a full timestamp than reject one.
/// </summary>
public record IngestSleepEntry(
    DateOnly? Date,
    string? BedTime,
    string? WakeTime,
    int? TimeInBedMinutes,
    int? ActualSleepMinutes);

public record IngestSleepRequest(List<IngestSleepEntry> Entries);
