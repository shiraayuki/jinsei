using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

public class HabitsApiTests : IDisposable
{
    private readonly TestWebAppFactory _factory;
    private readonly HttpClient _client;

    public HabitsApiTests()
    {
        _factory = new TestWebAppFactory();
        _client = _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            HandleCookies = true,
            AllowAutoRedirect = false,
        });
    }

    public void Dispose() => _factory.Dispose();

    private async Task RegisterAndLoginAsync(string email = "habits@test.com")
    {
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "password123",
            displayName = "Test",
        });
    }

    private static object DailySchedule => new { type = "daily", targetCount = 1, daysOfWeek = (int[]?)null, intervalDays = (int?)null };

    [Fact]
    public async Task ListHabits_Unauthenticated_Returns401()
    {
        var res = await _client.GetAsync("/api/habits");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task CreateHabit_Returns201()
    {
        await RegisterAndLoginAsync();

        var res = await _client.PostAsJsonAsync("/api/habits", new
        {
            name = "Run",
            description = (string?)null,
            color = "#6366f1",
            icon = (string?)null,
            schedule = DailySchedule,
        });

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    [Fact]
    public async Task CreateAndListHabit_ReturnsHabit()
    {
        await RegisterAndLoginAsync($"{Guid.NewGuid()}@test.com");

        await _client.PostAsJsonAsync("/api/habits", new
        {
            name = "Meditate",
            description = (string?)null,
            color = "#6366f1",
            icon = (string?)null,
            schedule = DailySchedule,
        });

        var listRes = await _client.GetAsync("/api/habits");
        Assert.Equal(HttpStatusCode.OK, listRes.StatusCode);

        var habits = await listRes.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.NotNull(habits);
        Assert.Single(habits);
        Assert.Equal("Meditate", habits[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task LogEntry_SetsCompletedToday()
    {
        await RegisterAndLoginAsync($"{Guid.NewGuid()}@test.com");

        var createRes = await _client.PostAsJsonAsync("/api/habits", new
        {
            name = "Drink Water",
            description = (string?)null,
            color = "#6366f1",
            icon = (string?)null,
            schedule = DailySchedule,
        });

        var habit = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var id = habit.GetProperty("id").GetString();

        await _client.PostAsJsonAsync($"/api/habits/{id}/entries", new
        {
            date = DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd"),
            completedCount = 1,
            notes = (string?)null,
        });

        var listRes = await _client.GetAsync("/api/habits");
        var habits = await listRes.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.True(habits![0].GetProperty("completedToday").GetBoolean());
    }

    [Fact]
    public async Task DeleteHabit_ArchivesIt()
    {
        await RegisterAndLoginAsync($"{Guid.NewGuid()}@test.com");

        var createRes = await _client.PostAsJsonAsync("/api/habits", new
        {
            name = "To Delete",
            description = (string?)null,
            color = "#6366f1",
            icon = (string?)null,
            schedule = DailySchedule,
        });

        var habit = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var id = habit.GetProperty("id").GetString();

        var deleteRes = await _client.DeleteAsync($"/api/habits/{id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteRes.StatusCode);

        var listRes = await _client.GetAsync("/api/habits");
        var habits = await listRes.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.Empty(habits!);
    }
}
