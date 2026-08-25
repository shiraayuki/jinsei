using System.Text.Json;

/// <summary>
/// The analytics service is pure arithmetic over stored payloads, so it is
/// exercised directly rather than through the API: the interesting cases are
/// the ones about which set counts and when a lift is called stalled.
/// </summary>
public class WorkoutAnalyticsTests
{
    private static readonly JsonSerializerOptions Camel =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static WorkoutLog Log(DateOnly date, params object[] exercises) => new()
    {
        Id = Guid.NewGuid(),
        UserId = "u",
        ExternalId = Guid.NewGuid().ToString(),
        Date = date,
        StartedAt = new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero),
        Title = "Session",
        DurationMinutes = 60,
        PayloadJson = JsonSerializer.Serialize(exercises, Camel),
    };

    private static object Exercise(string name, string? muscleGroup, params (decimal Weight, int Reps)[] sets) => new
    {
        name,
        muscleGroup,
        sets = sets.Select(s => new
        {
            weightKg = s.Weight,
            reps = s.Reps,
            durationSeconds = (int?)null,
            distanceMeters = (decimal?)null,
        }).ToArray(),
    };

    [Fact]
    public void EstimatesOneRepMaxFromTheHeaviestQualifyingSet()
    {
        var today = new DateOnly(2026, 8, 25);
        var logs = new List<WorkoutLog>
        {
            Log(today.AddDays(-3), Exercise("Bench Press", "chest", (80, 5), (100, 1), (90, 3))),
        };

        var result = WorkoutAnalyticsService.Build(logs, today, 90);
        var bench = Assert.Single(result.Exercises);

        // Epley over every qualifying set: 100 × 1 → 103.3 beats 90 × 3 → 99
        // and 80 × 5 → 93.3, so the single is the one the estimate comes from.
        Assert.Equal(103.3m, bench.LatestOneRepMax);
        Assert.Equal(3, bench.DaysSince);
    }

    [Fact]
    public void IgnoresHighRepSetsForTheEstimate()
    {
        var today = new DateOnly(2026, 8, 25);
        var logs = new List<WorkoutLog> { Log(today, Exercise("Leg Extension", "quadriceps", (40, 20))) };

        var bench = Assert.Single(WorkoutAnalyticsService.Build(logs, today, 90).Exercises);
        Assert.Null(bench.LatestOneRepMax);
        Assert.Equal(1, bench.Sessions);
    }

    [Fact]
    public void FlagsALiftWhoseBestIsOlderThanFourWeeks()
    {
        var today = new DateOnly(2026, 8, 25);
        var logs = new List<WorkoutLog>
        {
            Log(today.AddDays(-60), Exercise("Squat", "quadriceps", (140, 3))),
            Log(today.AddDays(-45), Exercise("Squat", "quadriceps", (130, 3))),
            Log(today.AddDays(-14), Exercise("Squat", "quadriceps", (130, 3))),
            Log(today.AddDays(-3), Exercise("Squat", "quadriceps", (135, 3))),
        };

        var squat = Assert.Single(WorkoutAnalyticsService.Build(logs, today, 90).Exercises);
        Assert.True(squat.Stagnant);
        Assert.Equal("2026-06-26", squat.BestDate);
    }

    [Fact]
    public void DoesNotFlagALiftThatSetItsBestRecently()
    {
        var today = new DateOnly(2026, 8, 25);
        var logs = new List<WorkoutLog>
        {
            Log(today.AddDays(-40), Exercise("Row", "back", (60, 5))),
            Log(today.AddDays(-30), Exercise("Row", "back", (62.5m, 5))),
            Log(today.AddDays(-20), Exercise("Row", "back", (65, 5))),
            Log(today.AddDays(-5), Exercise("Row", "back", (70, 5))),
        };

        var row = Assert.Single(WorkoutAnalyticsService.Build(logs, today, 90).Exercises);
        Assert.False(row.Stagnant);
        Assert.True(row.ChangePercent > 0);
    }

    [Fact]
    public void GroupsSetsByReportedMuscleAndComparesAgainstThePreviousFourWeeks()
    {
        var today = new DateOnly(2026, 8, 25);
        var logs = new List<WorkoutLog>
        {
            Log(today.AddDays(-40), Exercise("Bench Press", "chest", (80, 5), (80, 5))),
            Log(today.AddDays(-10), Exercise("Bench Press", "chest", (80, 5), (80, 5), (80, 5))),
        };

        var chest = Assert.Single(WorkoutAnalyticsService.Build(logs, today, 90).MuscleGroups);
        Assert.Equal("chest", chest.Group);
        Assert.Equal(3, chest.Sets);
        Assert.Equal(2, chest.PreviousSets);
        Assert.Equal(0.8, chest.SetsPerWeek, 3);
        Assert.Equal(10, chest.DaysSince);
    }

    [Fact]
    public void FallsBackToTheExerciseNameWhenNoMuscleGroupWasStored()
    {
        var today = new DateOnly(2026, 8, 25);
        var logs = new List<WorkoutLog> { Log(today, Exercise("Barbell Bench Press", null, (80, 5))) };

        var group = Assert.Single(WorkoutAnalyticsService.Build(logs, today, 90).MuscleGroups);
        Assert.Equal("chest", group.Group);
    }

    [Fact]
    public void CountsEveryWeekInTheWindowIncludingTheEmptyOnes()
    {
        var today = new DateOnly(2026, 8, 25);
        var logs = new List<WorkoutLog> { Log(today, Exercise("Deadlift", "hamstrings", (100, 5))) };

        var result = WorkoutAnalyticsService.Build(logs, today, 28);

        // Four weeks of history plus the running one, whether or not they were
        // trained: a gap is the finding.
        Assert.Equal(5, result.Weekly.Count);
        Assert.Equal(1, result.Weekly[^1].Sessions);
        Assert.All(result.Weekly.SkipLast(1), w => Assert.Equal(0, w.Sessions));
        Assert.Equal(500m, result.Totals.VolumeKg);
    }
}

/// <summary>The endpoints themselves: routing, auth and an empty-account shape.</summary>
public class AnalyticsEndpointTests
{
    [Fact]
    public async Task WorkoutAnalytics_AnswersWithEmptyRollUpsForAFreshAccount()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.GetAsync("/api/workouts/analytics?days=28");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetProperty("totals").GetProperty("sessions").GetInt32());
        Assert.Equal(5, body.GetProperty("weekly").GetArrayLength());
        Assert.Empty(body.GetProperty("exercises").EnumerateArray());
    }

    [Fact]
    public async Task HabitOverview_CountsOneRowPerDayInTheWindow()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.GetAsync("/api/habits/overview?days=14");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(14, body.GetProperty("daily").GetArrayLength());
        Assert.Equal(7, body.GetProperty("weekdayRates").GetArrayLength());
    }

    [Fact]
    public async Task Analytics_RequiresASignedInUser()
    {
        using var app = TestApp.Anonymous();

        var res = await app.Client.GetAsync("/api/workouts/analytics");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
