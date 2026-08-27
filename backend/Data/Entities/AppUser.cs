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

    /// <summary>
    /// How fast to move, as a percentage of body weight per week. Positive is
    /// downward — 0.6 means half a percent and a bit off the trend weight every
    /// week. Null means no rate is being steered towards.
    /// </summary>
    public decimal? WeeklyRatePercent { get; set; }

    /// <summary>
    /// Whether the week's calorie target is written into <see cref="KcalGoal"/>
    /// on its own every Monday, rather than waiting for the button under
    /// Metrics → Body to be pressed. Off unless it was asked for: a goal that
    /// changes by itself is not something to discover.
    /// </summary>
    public bool AutoKcalGoal { get; set; }

    /// <summary>
    /// When the goal was last written from the measured target — by the button
    /// or by the weekly job. It is also how the job knows a week has been
    /// handled, so a container that was down on Monday catches up on Tuesday
    /// instead of skipping the week.
    /// </summary>
    public DateTimeOffset? KcalGoalUpdatedAt { get; set; }

    /// <summary>
    /// The two notifications that are about the account rather than about one
    /// habit. Both off until asked for, and both useless without a registered
    /// device — the switches live next to the one that registers it.
    /// </summary>
    public bool NotifyEveningCheck { get; set; }
    public bool NotifyWeeklyReview { get; set; }

    /// <summary>
    /// SHA-256 of the ingest token, which lets a phone shortcut post steps
    /// without a session. The token itself is never stored: it is shown once
    /// when it is created and can only be replaced, not recovered.
    /// </summary>
    public string? IngestTokenHash { get; set; }
    public DateTimeOffset? IngestTokenCreatedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
