public class Exercise
{
    public Guid Id { get; set; }
    public string? UserId { get; set; }
    public AppUser? User { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string? Equipment { get; set; }
    public bool IsCustom { get; set; }

    public ICollection<ExerciseMuscle> ExerciseMuscles { get; set; } = [];
    public ICollection<WorkoutExercise> WorkoutExercises { get; set; } = [];
}
