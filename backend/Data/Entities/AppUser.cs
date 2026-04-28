using Microsoft.AspNetCore.Identity;

public class AppUser : IdentityUser
{
    public string? DisplayName { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
