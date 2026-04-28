public class MealEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public string MealType { get; set; } = null!;
    public Guid FoodItemId { get; set; }
    public FoodItem FoodItem { get; set; } = null!;
    public decimal Grams { get; set; }
    public DateTimeOffset LoggedAt { get; set; } = DateTimeOffset.UtcNow;
}
