using System.Net.Http.Headers;

/// <summary>
/// The ingest path is the only way into the app that is not a browser session,
/// so what it refuses matters as much as what it writes.
/// </summary>
public class IngestTests
{
    private static async Task<string> IssueTokenAsync(TestApp app)
    {
        var res = await app.Client.PostAsJsonAsync("/api/auth/ingest-token", new { });
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }

    private static HttpRequestMessage Post(string? token, object payload)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/ingest/activity")
        {
            Content = JsonContent.Create(payload),
        };
        if (token is not null) req.Headers.Add("X-Ingest-Token", token);
        return req;
    }

    [Fact]
    public async Task Ingest_WritesTheDaysItWasGiven()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        var res = await app.Client.SendAsync(Post(token, new
        {
            entries = new[]
            {
                new { date = "2026-08-24", steps = 10432 },
                new { date = "2026-08-25", steps = 8210 },
            },
        }));
        res.EnsureSuccessStatusCode();

        var entries = await app.Client.GetFromJsonAsync<JsonElement>("/api/activity?days=30");
        var byDate = entries.EnumerateArray().ToDictionary(e => e.GetProperty("date").GetString()!);
        Assert.Equal(10432, byDate["2026-08-24"].GetProperty("steps").GetInt32());
        Assert.Equal(8210, byDate["2026-08-25"].GetProperty("steps").GetInt32());
    }

    [Fact]
    public async Task Ingest_ReplacesTheCountWhenADayComesAgain()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        await app.Client.SendAsync(Post(token, new { entries = new[] { new { date = "2026-08-24", steps = 4000 } } }));
        await app.Client.SendAsync(Post(token, new { entries = new[] { new { date = "2026-08-24", steps = 11500 } } }));

        var entries = await app.Client.GetFromJsonAsync<JsonElement>("/api/activity?days=30");
        var day = entries.EnumerateArray().Single(e => e.GetProperty("date").GetString() == "2026-08-24");
        Assert.Equal(11500, day.GetProperty("steps").GetInt32());
    }

    [Fact]
    public async Task Ingest_LeavesAnAnswerGivenByHandAlone()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        await app.Client.PostAsJsonAsync("/api/activity", new
        {
            date = "2026-08-24",
            steps = (int?)null,
            cardio = true,
            cardioMinutes = 35,
        });

        await app.Client.SendAsync(Post(token, new { entries = new[] { new { date = "2026-08-24", steps = 9000 } } }));

        var entries = await app.Client.GetFromJsonAsync<JsonElement>("/api/activity?days=30");
        var day = entries.EnumerateArray().Single(e => e.GetProperty("date").GetString() == "2026-08-24");
        Assert.Equal(9000, day.GetProperty("steps").GetInt32());
        Assert.True(day.GetProperty("cardio").GetBoolean());
        Assert.Equal(35, day.GetProperty("cardioMinutes").GetInt32());
    }

    [Fact]
    public async Task Ingest_AcceptsTheTokenAsABearerHeader()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/ingest/activity")
        {
            Content = JsonContent.Create(new { entries = new[] { new { date = "2026-08-24", steps = 7000 } } }),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var res = await app.Client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Ingest_RefusesAWrongOrMissingToken()
    {
        using var app = await TestApp.SignedInAsync();
        await IssueTokenAsync(app);

        var payload = new { entries = new[] { new { date = "2026-08-24", steps = 7000 } } };

        Assert.Equal(HttpStatusCode.Unauthorized, (await app.Client.SendAsync(Post("not-the-token", payload))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.Client.SendAsync(Post(null, payload))).StatusCode);
    }

    [Fact]
    public async Task Ingest_StopsWorkingOnceTheTokenIsRevoked()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        await app.Client.DeleteAsync("/api/auth/ingest-token");

        var res = await app.Client.SendAsync(Post(token, new { entries = new[] { new { date = "2026-08-24", steps = 7000 } } }));
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Ingest_IssuingAgainInvalidatesTheOldToken()
    {
        using var app = await TestApp.SignedInAsync();
        var first = await IssueTokenAsync(app);
        var second = await IssueTokenAsync(app);

        Assert.NotEqual(first, second);

        var payload = new { entries = new[] { new { date = "2026-08-24", steps = 7000 } } };
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.Client.SendAsync(Post(first, payload))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await app.Client.SendAsync(Post(second, payload))).StatusCode);
    }

    [Fact]
    public async Task Ingest_AnswersUnauthorizedBeforeItLooksAtTheBody()
    {
        using var app = await TestApp.SignedInAsync();
        await IssueTokenAsync(app);

        // An empty payload is invalid, but a caller without a token should not
        // find that out.
        var res = await app.Client.SendAsync(Post(null, new { entries = Array.Empty<object>() }));
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Ingest_RejectsAnImpossibleStepCount()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        await app.Client.SendAsync(Post(token, new { entries = new[] { new { date = "2026-08-24", steps = 900_000 } } }));

        var entries = await app.Client.GetFromJsonAsync<JsonElement>("/api/activity?days=30");
        Assert.Empty(entries.EnumerateArray().Where(e => e.GetProperty("steps").ValueKind != JsonValueKind.Null));
    }
}
