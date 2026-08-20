/// <summary>Body measurements for a day. Either value may stand on its own.</summary>
public class WeightEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? WaistCm { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
