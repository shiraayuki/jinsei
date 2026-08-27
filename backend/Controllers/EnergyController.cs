using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// The week's calorie target, and the one place it is worked out.
///
/// It used to be computed in the browser over whatever range the chart above
/// it was showing, which meant the number moved when the range switch did. It
/// is served from here so the figure on the screen, the figure the button
/// writes and the figure the Monday job writes are the same figure.
/// </summary>
[ApiController]
[Route("api/energy")]
[Authorize]
public class EnergyController : ControllerBase
{
    private readonly EnergyService _energy;
    private readonly UserManager<AppUser> _users;

    public EnergyController(EnergyService energy, UserManager<AppUser> users)
    {
        _energy = energy;
        _users = users;
    }

    [HttpGet("target")]
    public async Task<IActionResult> Target(CancellationToken ct)
    {
        var user = await _users.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var result = await _energy.ComputeAsync(user.Id, DateOnly.FromDateTime(DateTime.Today), ct);
        return Ok(ToDto(result, user));
    }

    /// <summary>Writes the target into the calorie goal, on request.</summary>
    [HttpPost("target/apply")]
    public async Task<IActionResult> Apply(CancellationToken ct)
    {
        var user = await _users.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var applied = await _energy.ApplyAsync(user.Id, today, ct);
        if (applied is null) return BadRequest("There is no measured target yet.");

        var result = await _energy.ComputeAsync(user.Id, today, ct);
        return Ok(ToDto(result, await _users.FindByIdAsync(user.Id) ?? user));
    }

    private static object ToDto(EnergyService.EnergyTarget r, AppUser user) => new
    {
        Tdee = Rounded(r.Tdee),
        MeanKcal = Rounded(r.MeanKcal),
        r.RatePerWeek,
        AnchorWeightKg = r.AnchorWeightKg,
        r.WeeklyKg,
        r.TargetKcal,
        r.KcalDays,
        r.WeighIns,
        r.RatePercent,
        // What the screen needs to say why there is no number yet, without
        // knowing the thresholds itself.
        MinKcalDays = EnergyService.MinKcalDays,
        MinWeighIns = EnergyService.MinWeighIns,
        WindowDays = EnergyService.WindowDays,
        Adopted = r.TargetKcal != null && user.KcalGoal == r.TargetKcal,
        user.AutoKcalGoal,
        user.KcalGoalUpdatedAt,
    };

    private static int? Rounded(double? value) => value is double v ? (int)Math.Round(v) : null;
}
