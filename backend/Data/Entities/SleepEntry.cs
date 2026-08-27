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

    /// <summary>
    /// The night broken into its phases, in minutes, as Sleep Cycle's legend
    /// reports them: awake, light, REM ("Traum") and deep. They are stored as
    /// four independent readings rather than as shares of the night, because
    /// that is what the app shows and what a screenshot carries — anything
    /// derived from them (their sum, their share) is worked out on the way out.
    /// </summary>
    public int? AwakeMinutes { get; set; }
    public int? LightMinutes { get; set; }
    public int? RemMinutes { get; set; }
    public int? DeepMinutes { get; set; }

    /// <summary>
    /// Minutes from lying down to falling asleep, as Sleep Cycle's
    /// "Eingeschlafen nach". Part of the time in bed, not of the sleep.
    /// </summary>
    public int? SleepOnsetMinutes { get; set; }

    /// <summary>
    /// Clock time the night started, on the day before <see cref="Date"/> —
    /// unless it was already past midnight, in which case it is on Date itself.
    /// Kept as a time of day rather than a timestamp: what a bedtime decision
    /// needs is "half past ten", not an instant on a UTC axis.
    /// </summary>
    public TimeOnly? BedTime { get; set; }

    /// <summary>Clock time of getting up, on <see cref="Date"/>.</summary>
    public TimeOnly? WakeTime { get; set; }

    public string? Notes { get; set; }
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
