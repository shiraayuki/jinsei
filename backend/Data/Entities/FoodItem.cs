public class FoodItem
{
    public Guid Id { get; set; }
    public string Source { get; set; } = null!;
    public string? ExternalId { get; set; }
    public string? Barcode { get; set; }
    public string Name { get; set; } = null!;
    public string? Brand { get; set; }
    public decimal KcalPer100g { get; set; }
    public decimal ProteinPer100g { get; set; }
    public decimal CarbsPer100g { get; set; }
    public decimal FatPer100g { get; set; }
    public decimal? FiberPer100g { get; set; }
    public decimal? ServingSizeG { get; set; }
    public DateTimeOffset? CachedAt { get; set; }

    public ICollection<MealEntry> MealEntries { get; set; } = [];
}
