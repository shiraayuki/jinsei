using System.Net.Http.Json;

public class PushTests
{
    private static readonly Dictionary<string, string?> Configured = new()
    {
        ["Push:VapidPublicKey"] = "BItjQMWUL1bxV81Me8AoaSgHNKyXxWfinkYP6sWdqyyD4NVH3qGHj4cnwMm5UCDgwDd9B6HgfDfmsuWt06owRR0",
        ["Push:VapidPrivateKey"] = "oo0shHfJ2qjOtkVF7VVbCSYbwEwnJ-Md90-Tx5pdFdY",
        ["Push:Subject"] = "mailto:test@example.com",
    };

    private static object Subscription(string endpoint) => new
    {
        endpoint,
        p256dh = "BLc4xRzKlKORKWlbdgFaBrrPK3ydWAHo4M0gs0i1oEKgPpWG5tzUJq8VXCUKZBw6ijSAyDBTaZzYqXbwFOAmuOo",
        auth = "4vQK-SwCzcJGqBpLPYPQpw",
        label = "Test browser",
    };

    [Fact]
    public async Task Config_ReportsUnconfiguredWhenNoKeysAreSet()
    {
        using var app = await TestApp.SignedInAsync();

        var config = await app.Client.GetFromJsonAsync<JsonElement>("/api/push/config");

        // The same shape the screenshot import uses without a Gemini key: the
        // frontend hides the button rather than offering one that cannot work.
        Assert.False(config.GetProperty("configured").GetBoolean());
        Assert.Equal(JsonValueKind.Null, config.GetProperty("publicKey").ValueKind);
    }

    [Fact]
    public async Task Config_HandsOutThePublicKeyToSubscribeWith()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);

        var config = await app.Client.GetFromJsonAsync<JsonElement>("/api/push/config");

        Assert.True(config.GetProperty("configured").GetBoolean());
        Assert.Equal(Configured["Push:VapidPublicKey"], config.GetProperty("publicKey").GetString());
        Assert.Equal(0, config.GetProperty("devices").GetInt32());
    }

    [Fact]
    public async Task Subscribe_StoresTheDeviceAndCountsIt()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);

        var res = await app.Client.PostAsJsonAsync("/api/push/subscription", Subscription("https://push.example/abc"));
        res.EnsureSuccessStatusCode();

        var config = await app.Client.GetFromJsonAsync<JsonElement>("/api/push/config");
        Assert.Equal(1, config.GetProperty("devices").GetInt32());
    }

    [Fact]
    public async Task Subscribe_TwiceFromTheSameBrowserIsOneDevice()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);

        // A browser that is asked again hands back the endpoint it already
        // has, which is what makes this an update rather than a second device.
        await app.Client.PostAsJsonAsync("/api/push/subscription", Subscription("https://push.example/abc"));
        await app.Client.PostAsJsonAsync("/api/push/subscription", Subscription("https://push.example/abc"));

        var config = await app.Client.GetFromJsonAsync<JsonElement>("/api/push/config");
        Assert.Equal(1, config.GetProperty("devices").GetInt32());
    }

    [Fact]
    public async Task Subscribe_RefusesASubscriptionMissingItsKeys()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);

        var res = await app.Client.PostAsJsonAsync("/api/push/subscription", new
        {
            endpoint = "https://push.example/abc",
            p256dh = "",
            auth = "",
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Unsubscribe_RemovesOnlyTheBrowserThatAsked()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);
        await app.Client.PostAsJsonAsync("/api/push/subscription", Subscription("https://push.example/phone"));
        await app.Client.PostAsJsonAsync("/api/push/subscription", Subscription("https://push.example/desktop"));

        var res = await app.Client.DeleteAsync("/api/push/subscription?endpoint=https%3A%2F%2Fpush.example%2Fphone");
        res.EnsureSuccessStatusCode();

        var config = await app.Client.GetFromJsonAsync<JsonElement>("/api/push/config");
        Assert.Equal(1, config.GetProperty("devices").GetInt32());
    }

    [Fact]
    public async Task Test_RefusesWhenTheServerCannotSendAtAll()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PostAsJsonAsync("/api/push/test", new { });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Push_IsBehindAuth()
    {
        using var app = TestApp.Anonymous();

        Assert.Equal(HttpStatusCode.Unauthorized, (await app.Client.GetAsync("/api/push/config")).StatusCode);
    }

    [Fact]
    public void GeneratedKeys_AreTheUncompressedPointAndTheBareScalar()
    {
        var (publicKey, privateKey) = PushService.GenerateKeys();

        // 65 bytes and 32 bytes, base64url without padding — what the browser
        // and the push services both expect.
        Assert.Equal(87, publicKey.Length);
        Assert.Equal(43, privateKey.Length);
        Assert.DoesNotContain('=', publicKey);
        Assert.DoesNotContain('+', publicKey);
        Assert.DoesNotContain('/', publicKey);
        Assert.NotEqual(publicKey, PushService.GenerateKeys().PublicKey);
    }

    [Fact]
    public async Task Preferences_AreOffUntilTheyAreAskedFor()
    {
        using var app = await TestApp.SignedInAsync();

        var me = await app.Client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.False(me.GetProperty("notifyEveningCheck").GetBoolean());
        Assert.False(me.GetProperty("notifyWeeklyReview").GetBoolean());

        await app.Client.PutAsJsonAsync("/api/auth/profile", new { notifyWeeklyReview = true });

        me = await app.Client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.True(me.GetProperty("notifyWeeklyReview").GetBoolean());
        Assert.False(me.GetProperty("notifyEveningCheck").GetBoolean());
    }

    [Fact]
    public async Task HabitReminder_IsStoredOnTheSchedule()
    {
        using var app = await TestApp.SignedInAsync();

        var created = await app.Client.PostAsJsonAsync("/api/habits", new
        {
            name = "Lesen",
            schedule = new { type = "daily", targetCount = 1, remindAtLocal = "21:15" },
        });
        created.EnsureSuccessStatusCode();

        var habits = await app.Client.GetFromJsonAsync<List<JsonElement>>("/api/habits");
        Assert.NotNull(habits);
        Assert.Equal("21:15:00", habits[0].GetProperty("schedule").GetProperty("remindAtLocal").GetString());
    }
}
