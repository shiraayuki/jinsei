/// <summary>
/// A training session pulled from Hevy. Keyed by the provider's id so a repeated
/// sync updates the same row instead of duplicating it.
/// </summary>
public class WorkoutLog
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;

    public string Source { get; set; } = "hevy";
    public string ExternalId { get; set; } = null!;

    public DateOnly Date { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public string Title { get; set; } = null!;
    public int? DurationMinutes { get; set; }

    public int ExerciseCount { get; set; }
    public int SetCount { get; set; }
    public decimal VolumeKg { get; set; }

    /// <summary>Readable rendering of the session, shown in the log list.</summary>
    public string RawText { get; set; } = "";

    /// <summary>The parsed session as JSON, kept so the detail view needs no reparse.</summary>
    public string PayloadJson { get; set; } = "[]";

    public DateTimeOffset SyncedAt { get; set; } = DateTimeOffset.UtcNow;
}
