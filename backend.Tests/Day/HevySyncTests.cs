using System.Net.Http.Headers;

/// <summary>Answers every Hevy request with a canned payload, so the sync can be
/// exercised without reaching the real API.</summary>
public class StubHevyHandler : HttpMessageHandler
{
    private readonly string _body;
    public int Calls { get; private set; }

    public StubHevyHandler(string body) => _body = body;

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Calls++;
        var res = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(_body),
        };
        res.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        return Task.FromResult(res);
    }
}

public class HevySyncTests
{
    private const string OneStrengthWorkout = """
    {
      "page": 1,
      "page_count": 1,
      "workouts": [{
        "id": "hevy-1",
        "title": "Push",
        "start_time": "2026-08-17T16:00:00Z",
        "end_time": "2026-08-17T17:00:00Z",
        "exercises": [{
          "title": "Bankdrücken",
          "sets": [
            { "type": "warmup", "weight_kg": 40, "reps": 10 },
            { "type": "normal", "weight_kg": 80, "reps": 8 },
            { "type": "normal", "weight_kg": 80, "reps": 6 }
          ]
        }]
      }]
    }
    """;

    private const string OneCardioWorkout = """
    {
      "page": 1,
      "page_count": 1,
      "workouts": [{
        "id": "hevy-2",
        "title": "Laufband",
        "start_time": "2026-08-18T16:00:00Z",
        "end_time": "2026-08-18T16:30:00Z",
        "exercises": [{
          "title": "Treadmill",
          "sets": [{ "type": "normal", "duration_seconds": 1800, "distance_meters": 5000 }]
        }]
      }]
    }
    """;

    private static Task<TestApp> AppWith(string body, StubHevyHandler? handler = null)
    {
        var stub = handler ?? new StubHevyHandler(body);
        return TestApp.SignedInAsync(
            services => services.AddHttpClient<HevyClient>().ConfigurePrimaryHttpMessageHandler(() => stub),
            // The key only has to be present; the stub answers every request.
            new Dictionary<string, string?> { ["Hevy:ApiKey"] = "test-key" });
    }

    [Fact]
    public async Task Sync_StoresTheSessionAndSkipsWarmupSets()
    {
        using var app = await AppWith(OneStrengthWorkout);

        var res = await app.Client.PostAsJsonAsync("/api/workouts/sync", new { });
        var result = await res.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(1, result.GetProperty("added").GetInt32());

        var list = await app.Client.GetFromJsonAsync<List<JsonElement>>("/api/workouts?days=3650");
        Assert.NotNull(list);
        Assert.Single(list);
        // The warmup is dropped, so two sets and 80*8 + 80*6 of volume remain.
        Assert.Equal(2, list[0].GetProperty("setCount").GetInt32());
        Assert.Equal(1120m, list[0].GetProperty("volumeKg").GetDecimal());
        Assert.Equal(60, list[0].GetProperty("durationMinutes").GetInt32());
    }

    [Fact]
    public async Task Sync_RunTwiceUpdatesTheSameRow()
    {
        using var app = await AppWith(OneStrengthWorkout);

        await app.Client.PostAsJsonAsync("/api/workouts/sync", new { });
        var second = await app.Client.PostAsJsonAsync("/api/workouts/sync", new { });
        var result = await second.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(0, result.GetProperty("added").GetInt32());
        Assert.Equal(1, result.GetProperty("updated").GetInt32());

        var list = await app.Client.GetFromJsonAsync<List<JsonElement>>("/api/workouts?days=3650");
        Assert.NotNull(list);
        Assert.Single(list);
    }

    [Fact]
    public async Task Sync_WritesThePayloadInTheCasingTheClientReads()
    {
        using var app = await AppWith(OneStrengthWorkout);
        await app.Client.PostAsJsonAsync("/api/workouts/sync", new { });

        var list = await app.Client.GetFromJsonAsync<List<JsonElement>>("/api/workouts?days=3650");
        var id = list![0].GetProperty("id").GetString();
        var detail = await app.Client.GetFromJsonAsync<JsonElement>($"/api/workouts/{id}");

        var exercise = detail.GetProperty("exercises")[0];
        Assert.Equal("Bankdrücken", exercise.GetProperty("name").GetString());
        Assert.Equal(80m, exercise.GetProperty("sets")[0].GetProperty("weightKg").GetDecimal());
    }

    [Fact]
    public async Task Sync_MarksTheDayAsCardioWhenSetsCarryADuration()
    {
        using var app = await AppWith(OneCardioWorkout);

        var res = await app.Client.PostAsJsonAsync("/api/workouts/sync", new { });
        var result = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, result.GetProperty("cardioDays").GetInt32());

        var day = await app.Client.GetFromJsonAsync<JsonElement>("/api/activity/2026-08-18");
        Assert.True(day.GetProperty("cardio").GetBoolean());
        Assert.Equal(30, day.GetProperty("cardioMinutes").GetInt32());
    }

    [Fact]
    public async Task Sync_LeavesACardioAnswerGivenByHandAlone()
    {
        using var app = await AppWith(OneCardioWorkout);
        await app.Client.PostAsJsonAsync("/api/activity", new
        {
            date = "2026-08-18", steps = 8000, cardio = false, cardioMinutes = (int?)null,
        });

        await app.Client.PostAsJsonAsync("/api/workouts/sync", new { });

        var day = await app.Client.GetFromJsonAsync<JsonElement>("/api/activity/2026-08-18");
        Assert.False(day.GetProperty("cardio").GetBoolean());
    }

    [Fact]
    public async Task Sync_ReportsUnconfiguredRatherThanFailing()
    {
        // No stub: the real client is in place but has no API key.
        using var app = await TestApp.SignedInAsync();

        var status = await app.Client.GetFromJsonAsync<JsonElement>("/api/workouts/sync/status");
        Assert.False(status.GetProperty("configured").GetBoolean());

        var res = await app.Client.PostAsJsonAsync("/api/workouts/sync", new { });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, res.StatusCode);
    }
}
