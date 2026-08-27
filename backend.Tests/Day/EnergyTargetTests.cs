using System.Net.Http.Json;

public class EnergyTargetTests
{
    /// <summary>
    /// Four weeks of a clean linear cut: 82 kg falling by 50 g a day, 2400 kcal
    /// every day. The slope is -0.35 kg a week, so maintenance is
    /// 2400 + 0.35/7 × 7700 = 2785 kcal.
    /// </summary>
    private static async Task LogACleanCutAsync(HttpClient client)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        for (var back = 27; back >= 0; back--)
        {
            var date = today.AddDays(-back).ToString("yyyy-MM-dd");
            await client.PostAsJsonAsync("/api/weight", new { date, weightKg = 82.0 - 0.05 * (27 - back) });
            await client.PostAsJsonAsync("/api/nutrition", new { date, kcal = 2400 });
        }
    }

    [Fact]
    public async Task Target_MeasuresMaintenanceFromIntakeAndTheTrendSlope()
    {
        using var app = await TestApp.SignedInAsync();
        await LogACleanCutAsync(app.Client);

        var res = await app.Client.GetFromJsonAsync<JsonElement>("/api/energy/target");

        Assert.Equal(2785, res.GetProperty("tdee").GetInt32());
        Assert.Equal(2400, res.GetProperty("meanKcal").GetInt32());
        Assert.Equal(-0.35, res.GetProperty("ratePerWeek").GetDouble(), 2);
    }

    [Fact]
    public async Task Target_IsMaintenanceLessTheChosenPace()
    {
        using var app = await TestApp.SignedInAsync();
        await LogACleanCutAsync(app.Client);
        await app.Client.PutAsJsonAsync("/api/auth/profile", new { weeklyRatePercent = 0.6 });

        var res = await app.Client.GetFromJsonAsync<JsonElement>("/api/energy/target");

        var tdee = res.GetProperty("tdee").GetInt32();
        var weeklyKg = res.GetProperty("weeklyKg").GetDouble();
        var anchor = res.GetProperty("anchorWeightKg").GetDouble();

        // The pace applied to the anchor, and the anchor taken from the trend
        // rather than from the last weigh-in.
        Assert.Equal(anchor * 0.006, weeklyKg, 4);
        Assert.Equal((int)Math.Round(tdee - weeklyKg * 7700 / 7), res.GetProperty("targetKcal").GetInt32());
    }

    [Fact]
    public async Task Target_StaysBlankUntilThereIsEnoughLogged()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PutAsJsonAsync("/api/auth/profile", new { weeklyRatePercent = 0.6 });

        var today = DateOnly.FromDateTime(DateTime.Today);
        for (var back = 9; back >= 0; back--)
        {
            var date = today.AddDays(-back).ToString("yyyy-MM-dd");
            await app.Client.PostAsJsonAsync("/api/weight", new { date, weightKg = 82.0 - 0.05 * (9 - back) });
            await app.Client.PostAsJsonAsync("/api/nutrition", new { date, kcal = 2400 });
        }

        var res = await app.Client.GetFromJsonAsync<JsonElement>("/api/energy/target");

        // Ten weigh-ins is past that floor, ten calorie days is not — and the
        // estimate needs both, so the card counts rather than guesses.
        Assert.Equal(JsonValueKind.Null, res.GetProperty("tdee").ValueKind);
        Assert.Equal(JsonValueKind.Null, res.GetProperty("targetKcal").ValueKind);
        Assert.Equal(10, res.GetProperty("kcalDays").GetInt32());
        Assert.Equal(14, res.GetProperty("minKcalDays").GetInt32());
    }

    [Fact]
    public async Task Target_NeedsAPaceBeforeItIsATarget()
    {
        using var app = await TestApp.SignedInAsync();
        await LogACleanCutAsync(app.Client);

        var res = await app.Client.GetFromJsonAsync<JsonElement>("/api/energy/target");

        // Maintenance is measurable without a pace; where to sit against it is
        // a decision, not a measurement.
        Assert.Equal(2785, res.GetProperty("tdee").GetInt32());
        Assert.Equal(JsonValueKind.Null, res.GetProperty("targetKcal").ValueKind);
    }

    [Fact]
    public async Task Apply_WritesTheTargetIntoTheCalorieGoal()
    {
        using var app = await TestApp.SignedInAsync();
        await LogACleanCutAsync(app.Client);
        await app.Client.PutAsJsonAsync("/api/auth/profile", new { weeklyRatePercent = 0.6 });

        var before = await app.Client.GetFromJsonAsync<JsonElement>("/api/energy/target");
        var target = before.GetProperty("targetKcal").GetInt32();
        Assert.False(before.GetProperty("adopted").GetBoolean());

        var res = await app.Client.PostAsJsonAsync("/api/energy/target/apply", new { });
        res.EnsureSuccessStatusCode();

        var me = await app.Client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal(target, me.GetProperty("kcalGoal").GetInt32());

        var after = await app.Client.GetFromJsonAsync<JsonElement>("/api/energy/target");
        Assert.True(after.GetProperty("adopted").GetBoolean());
        Assert.NotEqual(JsonValueKind.Null, after.GetProperty("kcalGoalUpdatedAt").ValueKind);
    }

    [Fact]
    public async Task Apply_RefusesWhenThereIsNothingMeasuredYet()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PutAsJsonAsync("/api/auth/profile", new { weeklyRatePercent = 0.6 });

        var res = await app.Client.PostAsJsonAsync("/api/energy/target/apply", new { });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task AutoKcalGoal_IsOffUntilItIsAskedFor()
    {
        using var app = await TestApp.SignedInAsync();

        var me = await app.Client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.False(me.GetProperty("autoKcalGoal").GetBoolean());

        await app.Client.PutAsJsonAsync("/api/auth/profile", new { autoKcalGoal = true });

        me = await app.Client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.True(me.GetProperty("autoKcalGoal").GetBoolean());
    }

    [Fact]
    public void MondayOf_IsTheMondayOfThatWeek()
    {
        // 2026-08-27 is a Thursday.
        Assert.Equal(new DateOnly(2026, 8, 24), EnergyService.MondayOf(new DateOnly(2026, 8, 27)));
        Assert.Equal(new DateOnly(2026, 8, 24), EnergyService.MondayOf(new DateOnly(2026, 8, 24)));
        // A Sunday belongs to the week that started six days earlier, not the
        // one about to start.
        Assert.Equal(new DateOnly(2026, 8, 24), EnergyService.MondayOf(new DateOnly(2026, 8, 30)));
    }
}
