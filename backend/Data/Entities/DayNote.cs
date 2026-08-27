/// <summary>
/// The free note for a day, on its own row.
///
/// It used to hang off the wellbeing entry, and was orphaned when that was
/// removed. It does not belong on the weight or sleep row either: those refuse
/// to be saved without a measurement, so a day that is only a sentence would
/// have nowhere to go.
/// </summary>
public class DayNote
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }

    public string? Text { get; set; }

    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
