using System.Security.Cryptography;
using System.Text.Json;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Delivers a notification to every browser a user has agreed on.
///
/// Web Push rather than anything native, because the app is a PWA and there is
/// nothing else available to it. That has one condition worth stating: on iOS
/// this only exists once the app has been added to the home screen, and in a
/// Safari tab the permission prompt does nothing at all.
///
/// The private half of the VAPID pair is configuration, not a secret in the
/// database: it identifies this server to the push services and nothing else.
/// Without it the whole feature reports itself as unconfigured, the same way
/// the screenshot import does without a Gemini key.
/// </summary>
public class PushService
{
    private readonly AppDbContext _db;
    private readonly PushServiceClient _client;
    private readonly IConfiguration _config;
    private readonly ILogger<PushService> _log;

    public PushService(AppDbContext db, PushServiceClient client, IConfiguration config, ILogger<PushService> log)
    {
        _db = db;
        _client = client;
        _config = config;
        _log = log;
    }

    public string? PublicKey => Blank(_config["Push:VapidPublicKey"]);
    private string? PrivateKey => Blank(_config["Push:VapidPrivateKey"]);

    /// <summary>
    /// Who to shout at when a push service has a problem with our messages.
    /// The spec wants a mailto: or a URL; it is never shown to anyone.
    /// </summary>
    private string Subject => Blank(_config["Push:Subject"]) ?? "mailto:admin@localhost";

    public bool IsConfigured => PublicKey != null && PrivateKey != null;

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;

    /// <summary>What lands in the service worker's push event.</summary>
    public sealed record Notification(string Title, string Body, string Url, string Tag);

    /// <summary>
    /// Sends to every device the user has registered, and retires the ones the
    /// push service says are gone.
    ///
    /// A 404 or a 410 means that browser has thrown the subscription away —
    /// uninstalled, cleared, permission revoked — and it will never come back,
    /// so the row goes. Anything else is this delivery failing and is left
    /// alone: a push service having a bad minute should not cost you the
    /// device.
    /// </summary>
    public async Task<int> SendAsync(string userId, Notification notification, CancellationToken ct = default)
    {
        if (!IsConfigured) return 0;

        var devices = await _db.PushDevices.Where(d => d.UserId == userId).ToListAsync(ct);
        if (devices.Count == 0) return 0;

        var auth = new VapidAuthentication(PublicKey!, PrivateKey!) { Subject = Subject };
        var payload = JsonSerializer.Serialize(new
        {
            title = notification.Title,
            body = notification.Body,
            url = notification.Url,
            tag = notification.Tag,
        });

        var delivered = 0;
        var retired = new List<PushDevice>();

        foreach (var device in devices)
        {
            var subscription = new PushSubscription { Endpoint = device.Endpoint };
            subscription.SetKey(PushEncryptionKeyName.P256DH, device.P256dh);
            subscription.SetKey(PushEncryptionKeyName.Auth, device.Auth);

            var message = new PushMessage(payload)
            {
                // A day: a reminder that arrives two days late is worse than
                // one that never arrives. The tag also lets a second message
                // of the same kind replace the first on the lock screen.
                TimeToLive = 86_400,
                Topic = notification.Tag,
                Urgency = PushMessageUrgency.Normal,
            };

            try
            {
                await _client.RequestPushMessageDeliveryAsync(subscription, message, auth, ct);
                device.LastDeliveryAt = DateTimeOffset.UtcNow;
                delivered++;
            }
            catch (PushServiceClientException exc)
                when (exc.StatusCode is System.Net.HttpStatusCode.NotFound or System.Net.HttpStatusCode.Gone)
            {
                retired.Add(device);
            }
            catch (Exception exc)
            {
                _log.LogWarning("Push delivery failed for {UserId}: {Message}", userId, exc.Message);
            }
        }

        if (retired.Count > 0) _db.PushDevices.RemoveRange(retired);
        await _db.SaveChangesAsync(ct);
        return delivered;
    }

    /// <summary>
    /// A fresh VAPID pair, in the base64url form the browser and the push
    /// services expect: the public key is the uncompressed P-256 point, the
    /// private key is the bare 32-byte scalar.
    ///
    /// Here rather than behind an endpoint on purpose — it is run once, from
    /// the command line, and the output goes into configuration by hand.
    /// </summary>
    public static (string PublicKey, string PrivateKey) GenerateKeys()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var key = ecdsa.ExportParameters(includePrivateParameters: true);

        var publicKey = new byte[65];
        publicKey[0] = 0x04;
        key.Q.X!.CopyTo(publicKey, 1);
        key.Q.Y!.CopyTo(publicKey, 33);

        return (Base64Url(publicKey), Base64Url(key.D!));
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
