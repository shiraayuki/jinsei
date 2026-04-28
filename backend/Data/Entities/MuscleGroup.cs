public class MuscleGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;

    public ICollection<ExerciseMuscle> ExerciseMuscles { get; set; } = [];
}
