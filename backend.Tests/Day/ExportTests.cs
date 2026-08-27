using System.Net.Http.Json;

public class ExportTests
{
    [Fact]
    public async Task Csv_CarriesTheHeaderAndTheRow()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PostAsJsonAsync("/api/weight", new { date = "2026-08-20", weightKg = 81.4, waistCm = 84 });

        var res = await app.Client.GetAsync("/api/export/weight?format=csv");
        var body = await res.Content.ReadAsStringAsync();

        res.EnsureSuccessStatusCode();
        Assert.Equal("text/csv", res.Content.Headers.ContentType?.MediaType);
        Assert.Contains("date,weight_kg,waist_cm,notes,logged_at", body);
        Assert.Contains("2026-08-20,81.4,84", body);
    }

    [Fact]
    public async Task Csv_QuotesANoteThatHoldsACommaOrANewline()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PostAsJsonAsync("/api/weight", new
        {
            date = "2026-08-20",
            weightKg = 81.4,
            notes = "salty dinner, late\nand a \"heavy\" morning",
        });

        var body = await app.Client.GetStringAsync("/api/export/weight?format=csv");

        // Quoted once, with the inner quotes doubled, and the newline left
        // inside the field rather than ending the record.
        Assert.Contains("\"salty dinner, late\nand a \"\"heavy\"\" morning\"", body);
    }

    [Fact]
    public async Task Csv_WritesDecimalsWithAPointWhateverTheServerLocaleIs()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PostAsJsonAsync("/api/nutrition", new { date = "2026-08-20", kcal = 2400, waterL = 2.5 });

        var body = await app.Client.GetStringAsync("/api/export/nutrition?format=csv");

        Assert.Contains(",2.5,", body);
    }

    [Fact]
    public async Task Json_RendersDatesAndTimesTheWayTheApiDoes()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PostAsJsonAsync("/api/sleep", new
        {
            date = "2026-08-20",
            bedTime = "23:10",
            wakeTime = "07:05",
        });

        var rows = await app.Client.GetFromJsonAsync<List<JsonElement>>("/api/export/sleep");

        Assert.NotNull(rows);
        Assert.Equal("2026-08-20", rows[0].GetProperty("date").GetString());
        Assert.Equal("23:10", rows[0].GetProperty("bed_time").GetString());
        Assert.Equal("07:05", rows[0].GetProperty("wake_time").GetString());
    }

    [Fact]
    public async Task Json_NamesTheFileAfterTheAreaAndTheDay()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.GetAsync("/api/export/notes");

        var today = DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd");
        Assert.Contains($"jinsei-notes-{today}.json", res.Content.Headers.ContentDisposition?.ToString());
    }

    [Fact]
    public async Task Bundle_HoldsEveryAreaAndTheGoalsTheyWereLoggedAgainst()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PutAsJsonAsync("/api/auth/profile", new { kcalGoal = 2400 });
        await app.Client.PostAsJsonAsync("/api/weight", new { date = "2026-08-20", weightKg = 81.4 });

        var bundle = await app.Client.GetFromJsonAsync<JsonElement>("/api/export/all");

        Assert.Equal(2400, bundle.GetProperty("profile").GetProperty("kcal_goal").GetInt32());
        Assert.Equal(1, bundle.GetProperty("weight").GetArrayLength());
        foreach (var area in new[] { "sleep", "nutrition", "activity", "workouts", "habits", "notes" })
            Assert.Equal(JsonValueKind.Array, bundle.GetProperty(area).ValueKind);
    }

    [Fact]
    public async Task Bundle_RefusesCsvRatherThanFlatteningSevenTablesIntoOne()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.GetAsync("/api/export/all?format=csv");

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Export_OnlyEverSeesTheSignedInUsersRows()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PostAsJsonAsync("/api/weight", new { date = "2026-08-20", weightKg = 81.4 });

        // A second account against the same database, which is the only way
        // this says anything: two factories would be two databases, and the
        // export would come back empty however it filtered.
        using var other = app.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = true,
            AllowAutoRedirect = false,
        });
        await other.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"{Guid.NewGuid()}@test.com",
            password = "password123",
            displayName = "Someone else",
        });

        var rows = await other.GetFromJsonAsync<List<JsonElement>>("/api/export/weight");

        Assert.NotNull(rows);
        Assert.Empty(rows);
    }

    [Fact]
    public async Task Export_IsBehindAuth()
    {
        using var app = TestApp.Anonymous();

        var res = await app.Client.GetAsync("/api/export/weight");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Export_RejectsAnAreaItDoesNotHold()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.GetAsync("/api/export/mood");

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }
}
