/// <summary>How the day felt: hunger and energy on a 1–5 scale, plus a free note.</summary>
public class WellbeingEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }

    public int? Hunger { get; set; }
    public int? Energy { get; set; }
    public string? Notes { get; set; }

    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
