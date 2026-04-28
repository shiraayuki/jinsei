public class SleepEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public TimeOnly BedTime { get; set; }
    public TimeOnly WakeTime { get; set; }
    public int Quality { get; set; } // 1–5
    public string? Notes { get; set; }
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
