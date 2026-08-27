using System.Net.Http.Json;

public class WeekReviewTests
{
    /// <summary>A Monday, so the fixtures read the way the weeks do.</summary>
    private const string Monday = "2026-08-17";
    private const string PrevMonday = "2026-08-10";

    [Fact]
    public async Task Review_PutsEveryNumberNextToTheSameNumberAWeekEarlier()
    {
        using var app = await TestApp.SignedInAsync();

        await app.Client.PostAsJsonAsync("/api/nutrition", new { date = "2026-08-17", kcal = 2400 });
        await app.Client.PostAsJsonAsync("/api/nutrition", new { date = "2026-08-18", kcal = 2600 });
        await app.Client.PostAsJsonAsync("/api/nutrition", new { date = PrevMonday, kcal = 3000 });

        var review = await app.Client.GetFromJsonAsync<JsonElement>($"/api/summary/week/{Monday}/review");

        Assert.Equal("2026-08-17", review.GetProperty("weekStart").GetString());
        Assert.Equal("2026-08-23", review.GetProperty("weekEnd").GetString());
        Assert.Equal(2500, review.GetProperty("kcal").GetProperty("now").GetDouble());
        Assert.Equal(3000, review.GetProperty("kcal").GetProperty("before").GetDouble());
        Assert.Equal(2, review.GetProperty("kcalDays").GetInt32());
    }

    [Fact]
    public async Task Review_AnswersForAnyDayOfTheWeekAsked()
    {
        using var app = await TestApp.SignedInAsync();

        // A Thursday and a Sunday both belong to the week that started Monday.
        foreach (var day in new[] { "2026-08-20", "2026-08-23" })
        {
            var review = await app.Client.GetFromJsonAsync<JsonElement>($"/api/summary/week/{day}/review");
            Assert.Equal("2026-08-17", review.GetProperty("weekStart").GetString());
        }
    }

    [Fact]
    public async Task Review_CountsTheCalorieDaysThatLandedNearTheGoal()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PutAsJsonAsync("/api/auth/profile", new { kcalGoal = 2400 });

        // Within a tenth of the goal, and well outside it.
        await app.Client.PostAsJsonAsync("/api/nutrition", new { date = "2026-08-17", kcal = 2400 });
        await app.Client.PostAsJsonAsync("/api/nutrition", new { date = "2026-08-18", kcal = 2600 });
        await app.Client.PostAsJsonAsync("/api/nutrition", new { date = "2026-08-19", kcal = 3400 });

        var review = await app.Client.GetFromJsonAsync<JsonElement>($"/api/summary/week/{Monday}/review");

        Assert.Equal(3, review.GetProperty("kcalDays").GetInt32());
        Assert.Equal(2, review.GetProperty("kcalOnTargetDays").GetInt32());
    }

    [Fact]
    public async Task Review_MovesTheWeightOnTheTrendRatherThanOnTwoMornings()
    {
        using var app = await TestApp.SignedInAsync();

        // A fortnight of a steady drift, then one salty morning at the end.
        // The trend has to absorb it: two weigh-ins would report a gain.
        for (var back = 0; back < 14; back++)
        {
            var date = DateOnly.Parse("2026-08-23").AddDays(-back).ToString("yyyy-MM-dd");
            await app.Client.PostAsJsonAsync("/api/weight", new { date, weightKg = 80.0 + 0.1 * back });
        }
        await app.Client.PostAsJsonAsync("/api/weight", new { date = "2026-08-23", weightKg = 81.5 });

        var review = await app.Client.GetFromJsonAsync<JsonElement>($"/api/summary/week/{Monday}/review");

        Assert.True(review.GetProperty("ratePerWeekKg").GetDouble() < 0);
    }

    [Fact]
    public async Task Review_SaysNothingRatherThanZeroForAWeekWithNoReadings()
    {
        using var app = await TestApp.SignedInAsync();

        var review = await app.Client.GetFromJsonAsync<JsonElement>($"/api/summary/week/{Monday}/review");

        // A blank week is blank, not a week of zeroes — a mean of nothing is
        // not zero kilocalories.
        Assert.Equal(JsonValueKind.Null, review.GetProperty("kcal").GetProperty("now").ValueKind);
        Assert.Equal(JsonValueKind.Null, review.GetProperty("sleepMinutes").GetProperty("now").ValueKind);
        Assert.Equal(JsonValueKind.Null, review.GetProperty("ratePerWeekKg").ValueKind);
        // Sessions are a count, and a week with no training really is zero.
        Assert.Equal(0, review.GetProperty("sessions").GetProperty("now").GetDouble());
    }

    [Fact]
    public async Task Review_CarriesTheGoalsTheWeekIsReadAgainst()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PutAsJsonAsync("/api/auth/profile", new
        {
            kcalGoal = 2400,
            stepsGoal = 10000,
            sleepGoalMinutes = 450,
            weeklyWorkoutsGoal = 4,
        });

        var review = await app.Client.GetFromJsonAsync<JsonElement>($"/api/summary/week/{Monday}/review");

        Assert.Equal(2400, review.GetProperty("kcal").GetProperty("goal").GetDouble());
        Assert.Equal(10000, review.GetProperty("steps").GetProperty("goal").GetDouble());
        Assert.Equal(450, review.GetProperty("sleepMinutes").GetProperty("goal").GetDouble());
        Assert.Equal(4, review.GetProperty("sessions").GetProperty("goal").GetDouble());
    }

    [Fact]
    public async Task Review_IsBehindAuth()
    {
        using var app = TestApp.Anonymous();

        var res = await app.Client.GetAsync($"/api/summary/week/{Monday}/review");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
