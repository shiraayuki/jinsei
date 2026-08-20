/// <summary>Daily movement outside of the strength log: steps and cardio.</summary>
public class ActivityEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }

    public int? Steps { get; set; }

    /// <summary>
    /// Whether there was cardio at all. Null means nothing has been said about
    /// the day yet, which is what lets the Hevy sync fill it in without
    /// overwriting an answer that was given by hand.
    /// </summary>
    public bool? Cardio { get; set; }

    public int? CardioMinutes { get; set; }

    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
