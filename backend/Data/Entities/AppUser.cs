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

    /// <summary>Nightly sleep target in minutes, drawn as the line in the sleep chart.</summary>
    public int? SleepGoalMinutes { get; set; }

    /// <summary>Target body weight, drawn as the line the trend is heading for.</summary>
    public decimal? WeightGoalKg { get; set; }

    /// <summary>Weekly training targets: how many sessions and how many working sets.</summary>
    public int? WeeklyWorkoutsGoal { get; set; }
    public int? WeeklySetsGoal { get; set; }

    /// <summary>
    /// What an energy formula needs and the logs cannot supply: age, height,
    /// the sex constant, and how much the day moves. Every one of them is
    /// optional — without them the app falls back to what it measured.
    /// </summary>
    public DateOnly? BirthDate { get; set; }
    public int? HeightCm { get; set; }

    /// <summary>"male", "female", or null when it was not given.</summary>
    public string? Sex { get; set; }

    /// <summary>
    /// Physical activity level, the multiplier on the resting rate: 1.2 for a
    /// desk day through 1.9 for a manual job plus daily training.
    /// </summary>
    public decimal? ActivityLevel { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
