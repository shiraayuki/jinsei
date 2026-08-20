public class SleepEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;

    /// <summary>The day the night ended, i.e. the morning you woke up.</summary>
    public DateOnly Date { get; set; }

    /// <summary>Total time spent in bed, in minutes.</summary>
    public int? TimeInBedMinutes { get; set; }

    /// <summary>Time actually asleep, in minutes. Sleep Cycle reports this separately.</summary>
    public int? ActualSleepMinutes { get; set; }

    /// <summary>Sleep quality as the percentage Sleep Cycle reports, 0–100.</summary>
    public int? Quality { get; set; }

    public string? Notes { get; set; }
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
