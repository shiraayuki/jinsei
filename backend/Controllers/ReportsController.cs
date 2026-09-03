using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;
    private readonly DailyReportService _reports;

    public ReportsController(AppDbContext db, UserManager<AppUser> users, DailyReportService reports)
    {
        _db = db;
        _users = users;
        _reports = reports;
    }

    private string UserId => _users.GetUserId(User)!;

    [HttpGet("daily/{date}")]
    public async Task<IActionResult> Get(string date)
    {
        if (!DateOnly.TryParse(date, out var day)) return BadRequest("Invalid date.");
        var report = await _db.DailyReports.FirstOrDefaultAsync(r => r.UserId == UserId && r.Date == day);
        return Ok(report is null ? EmptyDto(day) : ToDto(report));
    }

    [HttpPost("daily/generate")]
    public async Task<IActionResult> Generate([FromBody] GenerateReportRequest? req)
    {
        var date = req?.Date ?? DateOnly.FromDateTime(DateTime.Today);

        try
        {
            var report = await _reports.GenerateAsync(UserId, date, DailyReportSource.Manual);
            return Ok(ToDto(report));
        }
        catch (ClaudeCliException exc)
        {
            return StatusCode(502, new { message = exc.Message });
        }
    }

    private static object EmptyDto(DateOnly day) => new
    {
        Id = (Guid?)null,
        Date = day.ToString("yyyy-MM-dd"),
        Content = (string?)null,
        GeneratedAt = (DateTimeOffset?)null,
        Source = (string?)null,
    };

    private static object ToDto(DailyReport r) => new
    {
        Id = (Guid?)r.Id,
        Date = r.Date.ToString("yyyy-MM-dd"),
        r.Content,
        r.GeneratedAt,
        Source = r.Source.ToString().ToLowerInvariant(),
    };
}

public record GenerateReportRequest(DateOnly? Date);
