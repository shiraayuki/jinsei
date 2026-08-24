/// <summary>
/// Covers the guards around the screenshot import. The model call itself is not
/// exercised here — everything that would reach Gemini is rejected before it
/// gets that far.
/// </summary>
public class ScreenshotImportTests
{
    private static readonly Dictionary<string, string?> Configured = new()
    {
        ["Gemini:ApiKey"] = "test-key",
    };

    [Fact]
    public async Task Status_ReportsUnconfiguredWithoutAKey()
    {
        using var app = await TestApp.SignedInAsync();

        var status = await app.Client.GetFromJsonAsync<JsonElement>("/api/import/status");

        Assert.False(status.GetProperty("configured").GetBoolean());
    }

    [Fact]
    public async Task Status_ReportsConfiguredWithAKey()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);

        var status = await app.Client.GetFromJsonAsync<JsonElement>("/api/import/status");

        Assert.True(status.GetProperty("configured").GetBoolean());
    }

    [Fact]
    public async Task Screenshot_IsUnavailableWithoutAKey()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PostAsJsonAsync("/api/import/screenshot", new
        {
            kind = "sleep",
            date = "2026-08-24",
            imageBase64 = "AAAA",
            mediaType = "image/jpeg",
        });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, res.StatusCode);
    }

    [Fact]
    public async Task Screenshot_RejectsAnUnknownKind()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);

        var res = await app.Client.PostAsJsonAsync("/api/import/screenshot", new
        {
            kind = "weight",
            date = "2026-08-24",
            imageBase64 = "AAAA",
            mediaType = "image/jpeg",
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Screenshot_RejectsAnUnsupportedMediaType()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);

        var res = await app.Client.PostAsJsonAsync("/api/import/screenshot", new
        {
            kind = "sleep",
            date = "2026-08-24",
            imageBase64 = "AAAA",
            mediaType = "application/pdf",
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Screenshot_RejectsAnImageThatIsTooLarge()
    {
        using var app = await TestApp.SignedInAsync(settings: Configured);

        var res = await app.Client.PostAsJsonAsync("/api/import/screenshot", new
        {
            kind = "sleep",
            date = "2026-08-24",
            imageBase64 = new string('A', 9 * 1024 * 1024),
            mediaType = "image/jpeg",
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Screenshot_NeedsASignedInUser()
    {
        using var factory = new TestWebAppFactory(settings: Configured);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var res = await client.PostAsJsonAsync("/api/import/screenshot", new
        {
            kind = "sleep",
            date = "2026-08-24",
            imageBase64 = "AAAA",
            mediaType = "image/jpeg",
        });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
