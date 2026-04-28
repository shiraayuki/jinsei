public class Workout
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public string? Name { get; set; }
    public string? Notes { get; set; }
    public int? DurationMinutes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<WorkoutExercise> WorkoutExercises { get; set; } = [];
}
