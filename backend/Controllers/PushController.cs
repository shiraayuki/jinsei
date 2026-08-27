using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Registering a browser for notifications, and taking it back off again.
/// </summary>
[ApiController]
[Route("api/push")]
[Authorize]
public class PushController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PushService _push;
    private readonly UserManager<AppUser> _users;

    public PushController(AppDbContext db, PushService push, UserManager<AppUser> users)
    {
        _db = db;
        _push = push;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    /// <summary>
    /// What the browser needs before it can even ask: whether this server can
    /// send at all, and the public key to subscribe with.
    /// </summary>
    [HttpGet("config")]
    public async Task<IActionResult> Config(CancellationToken ct)
    {
        var devices = await _db.PushDevices.CountAsync(d => d.UserId == UserId, ct);
        return Ok(new
        {
            Configured = _push.IsConfigured,
            _push.PublicKey,
            Devices = devices,
        });
    }

    /// <summary>
    /// Stores what the browser handed back from `pushManager.subscribe`. The
    /// endpoint is the identity: a browser that subscribes twice returns the
    /// same one, so this updates rather than piling up devices — and it may
    /// arrive on a different account than last time, which is why the owner is
    /// reassigned rather than assumed.
    /// </summary>
    [HttpPost("subscription")]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscriptionRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Endpoint) ||
            string.IsNullOrWhiteSpace(req.P256dh) ||
            string.IsNullOrWhiteSpace(req.Auth))
            return BadRequest("A subscription needs an endpoint and both keys.");

        var device = await _db.PushDevices.FirstOrDefaultAsync(d => d.Endpoint == req.Endpoint, ct);
        if (device is null)
        {
            device = new PushDevice { Id = Guid.NewGuid(), Endpoint = req.Endpoint };
            _db.PushDevices.Add(device);
        }

        device.UserId = UserId;
        device.P256dh = req.P256dh;
        device.Auth = req.Auth;
        device.Label = req.Label?.Trim() is { Length: > 0 } label ? label[..Math.Min(label.Length, 120)] : null;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("subscription")]
    public async Task<IActionResult> Unsubscribe([FromQuery] string endpoint, CancellationToken ct)
    {
        var device = await _db.PushDevices
            .FirstOrDefaultAsync(d => d.UserId == UserId && d.Endpoint == endpoint, ct);
        if (device is null) return NotFound();

        _db.PushDevices.Remove(device);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Sends one to yourself. The only way to find out whether the whole chain
    /// works without waiting until Sunday evening.
    /// </summary>
    [HttpPost("test")]
    public async Task<IActionResult> Test(CancellationToken ct)
    {
        if (!_push.IsConfigured) return BadRequest("Push is not configured on this server.");

        var sent = await _push.SendAsync(
            UserId,
            new PushService.Notification("Jinsei", "Benachrichtigungen sind eingerichtet.", "/", "test"),
            ct);

        return sent > 0 ? Ok(new { Sent = sent }) : BadRequest("No device took the message.");
    }
}

public record PushSubscriptionRequest(string Endpoint, string P256dh, string Auth, string? Label);
