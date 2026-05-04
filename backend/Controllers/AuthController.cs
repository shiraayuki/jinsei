using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly SignInManager<AppUser> _signInManager;
    private readonly IConfiguration _config;

    public AuthController(UserManager<AppUser> userManager, SignInManager<AppUser> signInManager, IConfiguration config)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (!_config.GetValue<bool>("Auth:AllowRegistration"))
            return StatusCode(403, "Registration is disabled.");

        var user = new AppUser
        {
            Email = req.Email,
            UserName = req.Email,
            DisplayName = req.DisplayName?.Trim(),
        };
        var result = await _userManager.CreateAsync(user, req.Password);

        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description));

        await _signInManager.SignInAsync(user, isPersistent: true);
        return Ok(ToDto(user));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var result = await _signInManager.PasswordSignInAsync(req.Email, req.Password, isPersistent: true, lockoutOnFailure: false);

        if (!result.Succeeded)
            return Unauthorized("Invalid credentials.");

        var user = await _userManager.FindByEmailAsync(req.Email);
        return Ok(ToDto(user!));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();
        return Ok(ToDto(user));
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Unauthorized();

        user.DisplayName = req.DisplayName?.Trim();
        if (req.Language is "en" or "de")
            user.Language = req.Language;
        await _userManager.UpdateAsync(user);
        return Ok(ToDto(user));
    }

    private static object ToDto(AppUser u) => new { u.Id, u.Email, u.DisplayName, u.Language };
}

public record RegisterRequest(string Email, string Password, string? DisplayName);
public record LoginRequest(string Email, string Password);
public record UpdateProfileRequest(string? DisplayName, string? Language);
