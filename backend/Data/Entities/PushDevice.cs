/// <summary>
/// One browser that agreed to be notified.
///
/// A row per device rather than per user: the same account is signed in on the
/// phone and on the desktop, and each of them hands out its own endpoint. The
/// endpoint is the address the push service gave out and is what identifies
/// the row — a browser that re-subscribes returns the same one.
/// </summary>
public class PushDevice
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = null!;
    public AppUser User { get; set; } = null!;

    /// <summary>The push service's URL for this browser. Unique across users.</summary>
    public string Endpoint { get; set; } = null!;

    /// <summary>The subscription's public key and auth secret, base64url as the browser gave them.</summary>
    public string P256dh { get; set; } = null!;
    public string Auth { get; set; } = null!;

    /// <summary>What the browser called itself, so a list of devices is readable.</summary>
    public string? Label { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// When this device last took a message. Not a heartbeat — a push service
    /// answering 404 or 410 is what actually retires a row — but it makes a
    /// device that has quietly stopped working visible.
    /// </summary>
    public DateTimeOffset? LastDeliveryAt { get; set; }
}
