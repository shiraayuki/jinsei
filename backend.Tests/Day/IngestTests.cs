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

    // --- nutrition ---------------------------------------------------------

    private static HttpRequestMessage PostNutrition(string? token, object payload)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/ingest/nutrition")
        {
            Content = JsonContent.Create(payload),
        };
        if (token is not null) req.Headers.Add("X-Ingest-Token", token);
        return req;
    }

    private static async Task<JsonElement> NutritionDayAsync(TestApp app, string date) =>
        await app.Client.GetFromJsonAsync<JsonElement>($"/api/nutrition/{date}");

    [Fact]
    public async Task IngestNutrition_WritesEverythingFatSecretSends()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        var res = await app.Client.SendAsync(PostNutrition(token, new
        {
            entries = new[]
            {
                new { date = "2026-08-25", kcal = 2310, proteinG = 194, carbsG = 197, fatG = 71, waterL = 3.0 },
            },
        }));
        res.EnsureSuccessStatusCode();

        var day = await NutritionDayAsync(app, "2026-08-25");
        Assert.Equal(2310, day.GetProperty("kcal").GetInt32());
        Assert.Equal(194, day.GetProperty("proteinG").GetInt32());
        Assert.Equal(197, day.GetProperty("carbsG").GetInt32());
        Assert.Equal(71, day.GetProperty("fatG").GetInt32());
        Assert.Equal(3.0m, day.GetProperty("waterL").GetDecimal());
    }

    [Fact]
    public async Task IngestNutrition_LeavesOutFieldsAlone()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        await app.Client.PostAsJsonAsync("/api/nutrition", new
        {
            date = "2026-08-25",
            kcal = 1000,
            waterL = 2.5,
            coffeeMl = 400,
            lastCoffee = "14:30",
            notes = "von Hand",
        });

        // The shortcut only ever knows what Health knows: calories and macros.
        await app.Client.SendAsync(PostNutrition(token, new
        {
            entries = new[] { new { date = "2026-08-25", kcal = 2310, proteinG = 194 } },
        }));

        var day = await NutritionDayAsync(app, "2026-08-25");
        Assert.Equal(2310, day.GetProperty("kcal").GetInt32());
        Assert.Equal(194, day.GetProperty("proteinG").GetInt32());
        Assert.Equal(2.5m, day.GetProperty("waterL").GetDecimal());
        Assert.Equal(400, day.GetProperty("coffeeMl").GetInt32());
        Assert.Equal("14:30", day.GetProperty("lastCoffee").GetString());
        Assert.Equal("von Hand", day.GetProperty("notes").GetString());
    }

    [Fact]
    public async Task IngestNutrition_ReplacesTheDayWhenItComesAgain()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        await app.Client.SendAsync(PostNutrition(token, new { entries = new[] { new { date = "2026-08-25", kcal = 1800 } } }));
        await app.Client.SendAsync(PostNutrition(token, new { entries = new[] { new { date = "2026-08-25", kcal = 2310 } } }));

        var day = await NutritionDayAsync(app, "2026-08-25");
        Assert.Equal(2310, day.GetProperty("kcal").GetInt32());
    }

    [Fact]
    public async Task IngestNutrition_SkipsAReadingThatCannotBeRight()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        await app.Client.SendAsync(PostNutrition(token, new
        {
            entries = new[] { new { date = "2026-08-25", kcal = 90_000, proteinG = 194 } },
        }));

        var day = await NutritionDayAsync(app, "2026-08-25");
        Assert.Equal(JsonValueKind.Null, day.GetProperty("kcal").ValueKind);
        Assert.Equal(194, day.GetProperty("proteinG").GetInt32());
    }

    [Fact]
    public async Task IngestNutrition_RefusesAWrongOrMissingToken()
    {
        using var app = await TestApp.SignedInAsync();
        await IssueTokenAsync(app);

        var payload = new { entries = new[] { new { date = "2026-08-25", kcal = 2310 } } };

        Assert.Equal(HttpStatusCode.Unauthorized, (await app.Client.SendAsync(PostNutrition("not-the-token", payload))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.Client.SendAsync(PostNutrition(null, payload))).StatusCode);
    }

    // --- sleep -------------------------------------------------------------

    private static HttpRequestMessage PostSleep(string? token, object payload)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/ingest/sleep")
        {
            Content = JsonContent.Create(payload),
        };
        if (token is not null) req.Headers.Add("X-Ingest-Token", token);
        return req;
    }

    private static async Task<JsonElement> SleepNightAsync(TestApp app, string date)
    {
        var entries = await app.Client.GetFromJsonAsync<JsonElement>("/api/sleep?days=60");
        return entries.EnumerateArray().Single(e => e.GetProperty("date").GetString() == date);
    }

    [Fact]
    public async Task IngestSleep_TakesTheTwoClockTimesAndWorksOutTheNight()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        var res = await app.Client.SendAsync(PostSleep(token, new
        {
            entries = new[] { new { date = "2026-08-25", bedTime = "20:15", wakeTime = "05:00" } },
        }));
        res.EnsureSuccessStatusCode();

        var night = await SleepNightAsync(app, "2026-08-25");
        Assert.Equal("20:15", night.GetProperty("bedTime").GetString());
        Assert.Equal("05:00", night.GetProperty("wakeTime").GetString());
        Assert.Equal(525, night.GetProperty("timeInBedMinutes").GetInt32());
    }

    [Fact]
    public async Task IngestSleep_ReadsWholeTimestampsAndFilesTheNightUnderTheMorning()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        // What Shortcuts hands over when the interval is passed on unformatted:
        // the night starts on the 24th and is filed under the 25th.
        var res = await app.Client.SendAsync(PostSleep(token, new
        {
            entries = new[]
            {
                new
                {
                    bedTime = "2026-08-24T20:15:00+02:00",
                    wakeTime = "2026-08-25T05:00:00+02:00",
                },
            },
        }));
        res.EnsureSuccessStatusCode();

        var night = await SleepNightAsync(app, "2026-08-25");
        Assert.Equal("20:15", night.GetProperty("bedTime").GetString());
        Assert.Equal("05:00", night.GetProperty("wakeTime").GetString());
        Assert.Equal(525, night.GetProperty("timeInBedMinutes").GetInt32());
    }

    [Fact]
    public async Task IngestSleep_RefusesMidnightToMidnight()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        // The shape a shortcut sends when its date format dropped the time.
        var res = await app.Client.SendAsync(PostSleep(token, new
        {
            entries = new[] { new { date = "2026-08-25", bedTime = "00:00", wakeTime = "00:00" } },
        }));

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetProperty("written").GetInt32());
        Assert.Equal("implausible night", body.GetProperty("skipped")[0].GetProperty("reason").GetString());

        var entries = await app.Client.GetFromJsonAsync<JsonElement>("/api/sleep?days=60");
        Assert.Empty(entries.EnumerateArray());
    }

    [Fact]
    public async Task IngestSleep_EchoesTheNightBackForChecking()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        var res = await app.Client.SendAsync(PostSleep(token, new
        {
            entries = new[] { new { date = "2026-08-25", bedTime = "22:30", wakeTime = "06:00" } },
        }));

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var night = body.GetProperty("nights")[0];
        Assert.Equal("2026-08-25", night.GetProperty("date").GetString());
        Assert.Equal("22:30", night.GetProperty("bedTime").GetString());
        Assert.Equal(450, night.GetProperty("timeInBedMinutes").GetInt32());
    }

    [Fact]
    public async Task IngestSleep_KeepsTheMeasuredDurationGivenByHand()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        // The night as Sleep Cycle reported it: a measured duration with the
        // awake time already taken off.
        await app.Client.PostAsJsonAsync("/api/sleep", new
        {
            date = "2026-08-25",
            timeInBedMinutes = 511,
            actualSleepMinutes = 445,
            notes = "von Hand",
        });

        await app.Client.SendAsync(PostSleep(token, new
        {
            entries = new[] { new { date = "2026-08-25", bedTime = "20:15", wakeTime = "05:00" } },
        }));

        var night = await SleepNightAsync(app, "2026-08-25");
        Assert.Equal(511, night.GetProperty("timeInBedMinutes").GetInt32());
        Assert.Equal(445, night.GetProperty("actualSleepMinutes").GetInt32());
        Assert.Equal("von Hand", night.GetProperty("notes").GetString());
        Assert.Equal("20:15", night.GetProperty("bedTime").GetString());
    }

    [Fact]
    public async Task IngestSleep_TakesTheAsleepMinutesWhenTheyAreSent()
    {
        using var app = await TestApp.SignedInAsync();
        var token = await IssueTokenAsync(app);

        await app.Client.SendAsync(PostSleep(token, new
        {
            entries = new[]
            {
                new { date = "2026-08-25", bedTime = "20:15", wakeTime = "05:00", actualSleepMinutes = 445 },
            },
        }));

        var night = await SleepNightAsync(app, "2026-08-25");
        Assert.Equal(445, night.GetProperty("actualSleepMinutes").GetInt32());
        Assert.Equal(85, night.GetProperty("efficiency").GetInt32());
    }

    [Fact]
    public async Task IngestSleep_RefusesAWrongOrMissingToken()
    {
        using var app = await TestApp.SignedInAsync();
        await IssueTokenAsync(app);

        var payload = new { entries = new[] { new { date = "2026-08-25", bedTime = "20:15", wakeTime = "05:00" } } };

        Assert.Equal(HttpStatusCode.Unauthorized, (await app.Client.SendAsync(PostSleep("not-the-token", payload))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.Client.SendAsync(PostSleep(null, payload))).StatusCode);
    }
}
