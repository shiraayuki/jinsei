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
        var result = await _signInManager.PasswordSignInAsync(req.Email, req.Password, isPersistent: true, lockoutOnFailure: true);

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

        if (req.KcalGoal is < 0 or > 20000) return BadRequest("Kcal goal out of range.");
        if (req.ProteinGoal is < 0 or > 1000) return BadRequest("Protein goal out of range.");
        if (req.WaterGoalL is < 0 or > 30) return BadRequest("Water goal out of range.");
        if (req.StepsGoal is < 0 or > 200000) return BadRequest("Steps goal out of range.");
        if (req.SleepGoalMinutes is < 0 or > 1440) return BadRequest("Sleep goal out of range.");
        if (req.WeightGoalKg is < 0 or > 500) return BadRequest("Weight goal out of range.");
        if (req.WeeklyWorkoutsGoal is < 0 or > 21) return BadRequest("Workout goal out of range.");
        if (req.WeeklySetsGoal is < 0 or > 500) return BadRequest("Set goal out of range.");
        if (req.HeightCm is < 50 or > 260) return BadRequest("Height out of range.");
        if (req.ActivityLevel is < 1.0m or > 2.5m) return BadRequest("Activity level out of range.");
        if (req.Sex is not (null or "male" or "female")) return BadRequest("Unknown sex.");
        if (req.BirthDate is DateOnly born
            && (born > DateOnly.FromDateTime(DateTime.Today) || born.Year < 1900))
            return BadRequest("Birth date out of range.");

        // A goal is cleared by sending null, so these are assigned rather than
        // merged.
        user.KcalGoal = req.KcalGoal;
        user.ProteinGoal = req.ProteinGoal;
        user.WaterGoalL = req.WaterGoalL;
        user.StepsGoal = req.StepsGoal;
        user.SleepGoalMinutes = req.SleepGoalMinutes;
        user.WeightGoalKg = req.WeightGoalKg;
        user.WeeklyWorkoutsGoal = req.WeeklyWorkoutsGoal;
        user.WeeklySetsGoal = req.WeeklySetsGoal;
        user.BirthDate = req.BirthDate;
        user.HeightCm = req.HeightCm;
        user.Sex = req.Sex;
        user.ActivityLevel = req.ActivityLevel;
        await _userManager.UpdateAsync(user);
        return Ok(ToDto(user));
    }

    private static object ToDto(AppUser u) => new
    {
        u.Id,
        u.Email,
        u.DisplayName,
        u.Language,
        u.KcalGoal,
        u.ProteinGoal,
        u.WaterGoalL,
        u.StepsGoal,
        u.SleepGoalMinutes,
        u.WeightGoalKg,
        u.WeeklyWorkoutsGoal,
        u.WeeklySetsGoal,
        BirthDate = u.BirthDate?.ToString("yyyy-MM-dd"),
        u.HeightCm,
        u.Sex,
        u.ActivityLevel,
    };
}

public record RegisterRequest(string Email, string Password, string? DisplayName);
public record LoginRequest(string Email, string Password);
public record UpdateProfileRequest(
    string? DisplayName,
    string? Language,
    int? KcalGoal,
    int? ProteinGoal,
    decimal? WaterGoalL,
    int? StepsGoal,
    int? SleepGoalMinutes,
    decimal? WeightGoalKg,
    int? WeeklyWorkoutsGoal,
    int? WeeklySetsGoal,
    DateOnly? BirthDate,
    int? HeightCm,
    string? Sex,
    decimal? ActivityLevel);
