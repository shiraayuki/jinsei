public class ExerciseMuscle
{
    public Guid ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int MuscleGroupId { get; set; }
    public MuscleGroup MuscleGroup { get; set; } = null!;
    public bool IsPrimary { get; set; }
}
