/// <summary>
/// The profile carries the goals and the body data every chart reads its line
/// from, and it is written by a full replace — so what happens to the fields
/// that were not touched is the thing worth testing.
/// </summary>
public class ProfileTests
{
    private static object FullProfile(string? sex = "male") => new
    {
        displayName = "Test",
        language = "de",
        kcalGoal = 2400,
        proteinGoal = 180,
        waterGoalL = 3.0m,
        stepsGoal = 9000,
        sleepGoalMinutes = 480,
        weightGoalKg = 78.0m,
        weeklyWorkoutsGoal = 4,
        weeklySetsGoal = 80,
        birthDate = "1996-08-30",
        heightCm = 183,
        sex,
        activityLevel = 1.55m,
    };

    [Fact]
    public async Task Profile_KeepsEveryFieldItWasGiven()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PutAsJsonAsync("/api/auth/profile", FullProfile());
        res.EnsureSuccessStatusCode();

        var me = await app.Client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal(480, me.GetProperty("sleepGoalMinutes").GetInt32());
        Assert.Equal(80, me.GetProperty("weeklySetsGoal").GetInt32());
        Assert.Equal("1996-08-30", me.GetProperty("birthDate").GetString());
        Assert.Equal(183, me.GetProperty("heightCm").GetInt32());
        Assert.Equal("male", me.GetProperty("sex").GetString());
        Assert.Equal(1.55m, me.GetProperty("activityLevel").GetDecimal());
    }

    [Fact]
    public async Task Profile_ClearsAFieldThatComesBackAsNull()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PutAsJsonAsync("/api/auth/profile", FullProfile());

        // A goal is cleared by sending null, which is also why the client has
        // to send back everything it is not changing.
        await app.Client.PutAsJsonAsync("/api/auth/profile", new { displayName = "Test", language = "de" });

        var me = await app.Client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal(JsonValueKind.Null, me.GetProperty("heightCm").ValueKind);
        Assert.Equal(JsonValueKind.Null, me.GetProperty("sleepGoalMinutes").ValueKind);
    }

    [Theory]
    [InlineData(20)]
    [InlineData(300)]
    public async Task Profile_RejectsAnImpossibleHeight(int height)
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PutAsJsonAsync("/api/auth/profile", new { heightCm = height });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Profile_RejectsAnUnknownSex()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.PutAsJsonAsync("/api/auth/profile", new { sex = "yes" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Profile_RejectsABirthDateInTheFuture()
    {
        using var app = await TestApp.SignedInAsync();

        var tomorrow = DateOnly.FromDateTime(DateTime.Today.AddDays(1)).ToString("yyyy-MM-dd");
        var res = await app.Client.PutAsJsonAsync("/api/auth/profile", new { birthDate = tomorrow });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }
}
