using Microsoft.AspNetCore.Identity;

public class AppUser : IdentityUser
{
    public string? DisplayName { get; set; }
    public string Language { get; set; } = "en";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
