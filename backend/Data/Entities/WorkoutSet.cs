public class WorkoutSet
{
    public Guid Id { get; set; }
    public Guid WorkoutExerciseId { get; set; }
    public WorkoutExercise WorkoutExercise { get; set; } = null!;
    public int SetNumber { get; set; }
    public int? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? Rpe { get; set; }
}
