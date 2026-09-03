/// <summary>
/// A headless Claude CLI's take on the day, one row per user per day.
///
/// Generated either by hand or by the nightly scheduler — never both for the
/// same day, since the scheduler skips a date that already has a row.
/// </summary>
public class DailyReport
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }

    public string Content { get; set; } = null!;
    public DateTimeOffset GeneratedAt { get; set; } = DateTimeOffset.UtcNow;
    public DailyReportSource Source { get; set; }
}

public enum DailyReportSource { Manual, Scheduled }
