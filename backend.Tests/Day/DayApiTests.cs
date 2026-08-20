public class DayApiTests
{
    [Fact]
    public async Task Sleep_RejectsMoreSleepThanTimeInBed()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PostAsJsonAsync("/api/sleep", new
        {
            date = "2026-08-20",
            timeInBedMinutes = 400,
            actualSleepMinutes = 500,
            quality = 80,
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Sleep_DerivesEfficiencyFromTheTwoDurations()
    {
        using var app = await TestApp.SignedInAsync();

        await app.Client.PostAsJsonAsync("/api/sleep", new
        {
            date = "2026-08-20",
            timeInBedMinutes = 480,
            actualSleepMinutes = 432,
            quality = 90,
        });

        var entries = await app.Client.GetFromJsonAsync<List<JsonElement>>("/api/sleep?days=30");

        Assert.NotNull(entries);
        Assert.Single(entries);
        Assert.Equal(90, entries[0].GetProperty("efficiency").GetInt32());
    }

    [Fact]
    public async Task Sleep_SecondPostForTheSameDayUpdatesRatherThanDuplicates()
    {
        using var app = await TestApp.SignedInAsync();

        await app.Client.PostAsJsonAsync("/api/sleep", new { date = "2026-08-20", timeInBedMinutes = 400, quality = 50 });
        await app.Client.PostAsJsonAsync("/api/sleep", new { date = "2026-08-20", timeInBedMinutes = 420, quality = 60 });

        var entries = await app.Client.GetFromJsonAsync<List<JsonElement>>("/api/sleep?days=30");

        Assert.NotNull(entries);
        Assert.Single(entries);
        Assert.Equal(420, entries[0].GetProperty("timeInBedMinutes").GetInt32());
        Assert.Equal(60, entries[0].GetProperty("quality").GetInt32());
    }

    [Fact]
    public async Task Weight_RequiresAtLeastOneMeasurement()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PostAsJsonAsync("/api/weight", new { date = "2026-08-20" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Weight_AcceptsAWaistMeasurementOnItsOwn()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PostAsJsonAsync("/api/weight", new { date = "2026-08-20", waistCm = 83.5 });
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        var entries = await app.Client.GetFromJsonAsync<List<JsonElement>>("/api/weight?days=30");

        Assert.NotNull(entries);
        Assert.Equal(JsonValueKind.Null, entries[0].GetProperty("weightKg").ValueKind);
        Assert.Equal(83.5m, entries[0].GetProperty("waistCm").GetDecimal());
    }

    [Fact]
    public async Task Nutrition_ReturnsAnEmptyDayForADateWithNothingLogged()
    {
        using var app = await TestApp.SignedInAsync();

        var day = await app.Client.GetFromJsonAsync<JsonElement>("/api/nutrition/2026-08-20");

        Assert.Equal("2026-08-20", day.GetProperty("date").GetString());
        Assert.Equal(JsonValueKind.Null, day.GetProperty("kcal").ValueKind);
    }

    [Fact]
    public async Task Activity_RejectsNegativeSteps()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PostAsJsonAsync("/api/activity", new { date = "2026-08-20", steps = -1 });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Wellbeing_RejectsAScaleOutsideOneToFive()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PostAsJsonAsync("/api/wellbeing", new { date = "2026-08-20", hunger = 6 });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Day_IsScopedToItsOwner()
    {
        using var mine = await TestApp.SignedInAsync();
        await mine.Client.PostAsJsonAsync("/api/weight", new { date = "2026-08-20", weightKg = 80 });

        using var theirs = await TestApp.SignedInAsync();
        var entries = await theirs.Client.GetFromJsonAsync<List<JsonElement>>("/api/weight?days=30");

        Assert.NotNull(entries);
        Assert.Empty(entries);
    }
}
