public class RoutineExercise
{
    public Guid Id { get; set; }
    public Guid RoutineId { get; set; }
    public Routine Routine { get; set; } = null!;
    public Guid ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int SetCount { get; set; } = 3;
    public int Order { get; set; }
}
