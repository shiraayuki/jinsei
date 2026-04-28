public class WeightEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public decimal WeightKg { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
