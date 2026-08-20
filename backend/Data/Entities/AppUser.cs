using Microsoft.AspNetCore.Identity;

public class AppUser : IdentityUser
{
    public string? DisplayName { get; set; }
    public string Language { get; set; } = "en";

    /// <summary>Daily targets, so the logged numbers can be shown against something.</summary>
    public int? KcalGoal { get; set; }
    public int? ProteinGoal { get; set; }
    public decimal? WaterGoalL { get; set; }
    public int? StepsGoal { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
