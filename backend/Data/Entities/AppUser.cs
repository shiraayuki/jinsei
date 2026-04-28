using Microsoft.AspNetCore.Identity;

public class AppUser : IdentityUser
{
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
