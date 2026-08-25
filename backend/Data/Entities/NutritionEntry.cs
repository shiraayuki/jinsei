/// <summary>One row per day holding the totals that are entered by hand.</summary>
public class NutritionEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }

    public int? Kcal { get; set; }
    public int? ProteinG { get; set; }
    public int? CarbsG { get; set; }
    public int? FatG { get; set; }

    /// <summary>Fibre in grams. FatSecret reports it, and it is the one carb
    /// number that says something on its own.</summary>
    public int? FiberG { get; set; }

    public decimal? WaterL { get; set; }
    public int? CoffeeMl { get; set; }

    /// <summary>Time of the last coffee, which is the part that matters for sleep.</summary>
    public TimeOnly? LastCoffee { get; set; }

    public string? Notes { get; set; }
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
