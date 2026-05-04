public class ExerciseRestPreference
{
    public string UserId { get; set; } = null!;
    public AppUser? User { get; set; }
    public Guid ExerciseId { get; set; }
    public Exercise? Exercise { get; set; }
    public int RestSeconds { get; set; }
}
