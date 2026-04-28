public class HabitEntry
{
    public Guid Id { get; set; }
    public Guid HabitId { get; set; }
    public Habit Habit { get; set; } = null!;
    public DateOnly Date { get; set; }
    public int CompletedCount { get; set; } = 1;
    public string? Notes { get; set; }
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
