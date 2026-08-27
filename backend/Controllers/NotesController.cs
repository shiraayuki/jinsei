using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/notes")]
[Authorize]
public class NotesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public NotesController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int days = 30)
    {
        var from = DateOnly.FromDateTime(DateTime.Today.AddDays(-days));
        var notes = await _db.DayNotes
            .Where(n => n.UserId == UserId && n.Date >= from)
            .OrderByDescending(n => n.Date)
            .ToListAsync();
        return Ok(notes.Select(ToDto));
    }

    [HttpGet("{date}")]
    public async Task<IActionResult> Get(string date)
    {
        if (!DateOnly.TryParse(date, out var day)) return BadRequest("Invalid date.");
        var note = await _db.DayNotes.FirstOrDefaultAsync(n => n.UserId == UserId && n.Date == day);
        return Ok(note is null ? EmptyDto(day) : ToDto(note));
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertNoteRequest req)
    {
        if (req.Text is { Length: > 4000 }) return BadRequest("Note is too long.");

        var existing = await _db.DayNotes.FirstOrDefaultAsync(n => n.UserId == UserId && n.Date == req.Date);
        var text = string.IsNullOrWhiteSpace(req.Text) ? null : req.Text.Trim();

        // An emptied note is a deleted note: leaving a blank row behind would
        // put an empty "Notizen" heading in every day report.
        if (text is null)
        {
            if (existing is not null) _db.DayNotes.Remove(existing);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        if (existing is null)
        {
            existing = new DayNote { Id = Guid.NewGuid(), UserId = UserId, Date = req.Date };
            _db.DayNotes.Add(existing);
        }

        existing.Text = text;
        existing.LoggedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static object EmptyDto(DateOnly day) => new
    {
        Id = (Guid?)null,
        Date = day.ToString("yyyy-MM-dd"),
        Text = (string?)null,
    };

    private static object ToDto(DayNote n) => new
    {
        Id = (Guid?)n.Id,
        Date = n.Date.ToString("yyyy-MM-dd"),
        n.Text,
        n.LoggedAt,
    };
}

public record UpsertNoteRequest(DateOnly Date, string? Text);
