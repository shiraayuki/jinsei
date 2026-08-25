using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/workouts")]
[Authorize]
public class WorkoutsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;
    private readonly WorkoutSyncService _sync;

    public WorkoutsController(AppDbContext db, UserManager<AppUser> users, WorkoutSyncService sync)
    {
        _db = db;
        _users = users;
        _sync = sync;
    }

    private string UserId => _users.GetUserId(User)!;

    // The stored payload is handed to the client verbatim as a JsonElement, so
    // it has to be written in the casing the API uses everywhere else —
    // serializing with the defaults would emit PascalCase and the client would
    // read undefined out of every field.
    private static readonly JsonSerializerOptions PayloadOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 90)
    {
        var from = DateOnly.FromDateTime(DateTime.Today.AddDays(-days));
        var logs = await _db.WorkoutLogs
            .Where(w => w.UserId == UserId && w.Date >= from)
            .OrderByDescending(w => w.Date).ThenByDescending(w => w.StartedAt)
            .ToListAsync();
        return Ok(logs.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var log = await _db.WorkoutLogs.FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);
        if (log is null) return NotFound();
        return Ok(ToDetailDto(log));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var log = await _db.WorkoutLogs.FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);
        if (log is null) return NotFound();
        _db.WorkoutLogs.Remove(log);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// The training numbers that need the set payload: weekly load, sets per
    /// muscle group and progression per exercise. Computed on request rather
    /// than stored, since the input is a few hundred rows and a stored roll-up
    /// would have to be invalidated by every sync.
    /// </summary>
    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics([FromQuery] int days = 90)
    {
        days = Math.Clamp(days, 7, 730);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var from = today.AddDays(-(days - 1));

        var logs = await _db.WorkoutLogs
            .Where(w => w.UserId == UserId && w.Date >= from)
            .OrderBy(w => w.Date)
            .ToListAsync();

        return Ok(WorkoutAnalyticsService.Build(logs, today, days));
    }

    [HttpGet("sync/status")]
    public IActionResult SyncStatus() => Ok(new { configured = _sync.IsConfigured, source = "hevy" });

    /// <summary>Pulls recent sessions from Hevy on demand.</summary>
    [HttpPost("sync")]
    public async Task<IActionResult> Sync([FromQuery] int pages = 4, CancellationToken ct = default)
    {
        if (!_sync.IsConfigured)
            return StatusCode(503, new { message = "Hevy ist nicht konfiguriert." });

        try
        {
            var result = await _sync.SyncAsync(UserId, pages, ct);
            return Ok(new { added = result.Added, updated = result.Updated, total = result.Total, cardioDays = result.CardioDays });
        }
        catch (HevyException exc)
        {
            return StatusCode(502, new { message = exc.Message });
        }
    }

    private static object ToDto(WorkoutLog w) => new
    {
        w.Id,
        Date = w.Date.ToString("yyyy-MM-dd"),
        w.Title,
        w.DurationMinutes,
        w.ExerciseCount,
        w.SetCount,
        w.VolumeKg,
        w.Source,
        w.SyncedAt,
    };

    private static object ToDetailDto(WorkoutLog w) => new
    {
        w.Id,
        Date = w.Date.ToString("yyyy-MM-dd"),
        w.Title,
        w.DurationMinutes,
        w.ExerciseCount,
        w.SetCount,
        w.VolumeKg,
        w.Source,
        w.SyncedAt,
        w.RawText,
        Exercises = JsonSerializer.Deserialize<JsonElement>(w.PayloadJson),
    };
}
