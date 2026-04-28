public class Habit
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string Color { get; set; } = "#6366f1";
    public string? Icon { get; set; }
    public bool Archived { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public HabitSchedule? Schedule { get; set; }
    public ICollection<HabitEntry> Entries { get; set; } = [];
}
