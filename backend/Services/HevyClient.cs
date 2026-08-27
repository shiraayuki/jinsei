using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

/// <summary>
/// Client for the official Hevy API (api.hevyapp.com/v1). Auth is a single
/// api-key header. Sessions come back with UTC timestamps, so the calendar day
/// is resolved in the configured local zone — a session logged at 00:30 local
/// would otherwise land on the previous day.
/// </summary>
public class HevyClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly IMemoryCache _cache;

    /// <summary>
    /// The exercise catalogue changes about as often as Hevy ships a release,
    /// so it is fetched once a day rather than on every sync — it is a dozen
    /// pages, and the sync itself is only four.
    /// </summary>
    private const string TemplateCacheKey = "hevy:exercise-templates";

    public HevyClient(HttpClient http, IConfiguration config, IMemoryCache cache)
    {
        _http = http;
        _config = config;
        _cache = cache;
        _http.Timeout = TimeSpan.FromSeconds(20);
    }

    private string? ApiKey => _config["Hevy:ApiKey"] is { Length: > 0 } key ? key : null;

    public bool IsConfigured => ApiKey is not null;

    /// <summary>
    /// The oldest day worth pulling. Everything before it is a different
    /// training life — imported history, a phase logged in another app — and it
    /// would only skew the analytics, which read the log as one series. Unset
    /// means no floor.
    /// </summary>
    private DateOnly? SyncFrom =>
        DateOnly.TryParse(_config["Hevy:SyncFrom"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)
            ? day
            : null;

    private TimeZoneInfo LocalZone
    {
        get
        {
            var id = _config["Hevy:TimeZone"] ?? "Europe/Vienna";
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { return TimeZoneInfo.Utc; }
        }
    }

    /// <summary>
    /// Fetches the most recent sessions, newest first, down to
    /// <c>Hevy:SyncFrom</c>. Hevy pages newest first, so reaching a session
    /// older than the floor means every page after it is older too — the walk
    /// stops there rather than reading pages it will throw away.
    /// </summary>
    public async Task<List<HevyWorkout>> FetchRecentAsync(int maxPages, CancellationToken ct = default)
    {
        if (ApiKey is null)
            throw new HevyException("Hevy is not configured: set Hevy:ApiKey.");

        var baseUrl = (_config["Hevy:BaseUrl"] ?? "https://api.hevyapp.com").TrimEnd('/');
        var result = new List<HevyWorkout>();

        for (var page = 1; page <= maxPages; page++)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/v1/workouts?page={page}&pageSize=10");
            req.Headers.Add("api-key", ApiKey);
            req.Headers.Add("Accept", "application/json");

            HttpResponseMessage res;
            try
            {
                res = await _http.SendAsync(req, ct);
            }
            catch (HttpRequestException exc)
            {
                throw new HevyException($"Hevy is unreachable: {exc.Message}", exc);
            }
            catch (TaskCanceledException exc) when (!ct.IsCancellationRequested)
            {
                throw new HevyException("Hevy did not answer in time.", exc);
            }

            if (res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                throw new HevyException("Hevy rejected the API key.");
            if (!res.IsSuccessStatusCode)
                throw new HevyException($"Hevy answered with HTTP {(int)res.StatusCode}.");

            JsonDocument doc;
            try
            {
                doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            }
            catch (JsonException exc)
            {
                throw new HevyException("Hevy returned malformed JSON.", exc);
            }

            using (doc)
            {
                if (!doc.RootElement.TryGetProperty("workouts", out var workouts) || workouts.GetArrayLength() == 0)
                    break;

                var reachedFloor = false;
                foreach (var raw in workouts.EnumerateArray())
                {
                    var workout = Convert(raw);
                    if (SyncFrom is DateOnly floor && workout.Date < floor)
                    {
                        reachedFloor = true;
                        continue;
                    }
                    result.Add(workout);
                }

                if (reachedFloor) break;

                var pageCount = doc.RootElement.TryGetProperty("page_count", out var pc) ? pc.GetInt32() : page;
                if (page >= pageCount) break;
            }
        }

        // Muscle groups are not part of the session payload, only of the
        // exercise catalogue, so they are resolved afterwards in one pass. A
        // catalogue that cannot be reached is not worth failing a sync over:
        // the sets are still the sets, they just group as "other".
        var templates = await FetchMuscleGroupsAsync(ct);
        if (templates.Count > 0)
        {
            foreach (var w in result)
            {
                for (var i = 0; i < w.Exercises.Count; i++)
                {
                    var ex = w.Exercises[i];
                    if (ex.TemplateId is { Length: > 0 } id && templates.TryGetValue(id, out var group))
                        w.Exercises[i] = ex with { MuscleGroup = group };
                }
            }
        }

        return result;
    }

    /// <summary>Exercise template id to primary muscle group, cached for a day.</summary>
    public async Task<Dictionary<string, string>> FetchMuscleGroupsAsync(CancellationToken ct = default)
    {
        if (ApiKey is null) return [];
        if (_cache.TryGetValue<Dictionary<string, string>>(TemplateCacheKey, out var cached) && cached is not null)
            return cached;

        var baseUrl = (_config["Hevy:BaseUrl"] ?? "https://api.hevyapp.com").TrimEnd('/');
        var map = new Dictionary<string, string>();

        try
        {
            for (var page = 1; page <= 20; page++)
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/v1/exercise_templates?page={page}&pageSize=100");
                req.Headers.Add("api-key", ApiKey);
                req.Headers.Add("Accept", "application/json");

                var res = await _http.SendAsync(req, ct);
                if (!res.IsSuccessStatusCode) break;

                using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
                if (!doc.RootElement.TryGetProperty("exercise_templates", out var items) || items.GetArrayLength() == 0)
                    break;

                foreach (var item in items.EnumerateArray())
                {
                    var id = item.TryGetProperty("id", out var i) ? i.GetString() : null;
                    var group = item.TryGetProperty("primary_muscle_group", out var g) ? g.GetString() : null;
                    if (!string.IsNullOrEmpty(id) && !string.IsNullOrEmpty(group)) map[id] = group;
                }

                var pageCount = doc.RootElement.TryGetProperty("page_count", out var pc) ? pc.GetInt32() : page;
                if (page >= pageCount) break;
            }
        }
        catch (Exception exc) when (exc is HttpRequestException or TaskCanceledException or JsonException)
        {
            return map;
        }

        if (map.Count > 0)
            _cache.Set(TemplateCacheKey, map, TimeSpan.FromHours(24));
        return map;
    }

    private HevyWorkout Convert(JsonElement raw)
    {
        var exercises = new List<HevyExercise>();
        if (raw.TryGetProperty("exercises", out var exs) && exs.ValueKind == JsonValueKind.Array)
        {
            foreach (var ex in exs.EnumerateArray())
            {
                var name = ex.TryGetProperty("title", out var t) ? t.GetString()?.Trim() : null;
                if (string.IsNullOrEmpty(name)) continue;

                var sets = new List<HevySet>();
                if (ex.TryGetProperty("sets", out var setEls) && setEls.ValueKind == JsonValueKind.Array)
                {
                    foreach (var s in setEls.EnumerateArray())
                    {
                        // Warmup sets are not part of the working volume.
                        if (s.TryGetProperty("type", out var type) && type.GetString() == "warmup")
                            continue;

                        sets.Add(new HevySet(
                            WeightKg: Decimal(s, "weight_kg"),
                            Reps: Int(s, "reps"),
                            DurationSeconds: Int(s, "duration_seconds"),
                            DistanceMeters: Decimal(s, "distance_meters")));
                    }
                }

                var templateId = ex.TryGetProperty("exercise_template_id", out var tid) ? tid.GetString() : null;
                exercises.Add(new HevyExercise(name, sets, templateId, null));
            }
        }

        var startedRaw = raw.TryGetProperty("start_time", out var st) ? st.GetString() : null;
        var started = DateTimeOffset.TryParse(startedRaw, out var parsed) ? parsed : DateTimeOffset.UtcNow;
        var local = TimeZoneInfo.ConvertTime(started, LocalZone);

        int? duration = null;
        if (raw.TryGetProperty("end_time", out var et)
            && DateTimeOffset.TryParse(et.GetString(), out var ended)
            && ended > started)
        {
            duration = (int)Math.Round((ended - started).TotalMinutes);
        }

        return new HevyWorkout(
            Id: raw.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
            Title: (raw.TryGetProperty("title", out var ti) ? ti.GetString()?.Trim() : null) is { Length: > 0 } title ? title : "Training",
            StartedAt: started,
            Date: DateOnly.FromDateTime(local.DateTime),
            DurationMinutes: duration,
            Exercises: exercises);
    }

    private static int? Int(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;

    private static decimal? Decimal(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : null;
}

public class HevyException : Exception
{
    public HevyException(string message, Exception? inner = null) : base(message, inner) { }
}

public record HevySet(decimal? WeightKg, int? Reps, int? DurationSeconds, decimal? DistanceMeters);

public record HevyExercise(string Name, List<HevySet> Sets, string? TemplateId = null, string? MuscleGroup = null);

public record HevyWorkout(
    string Id,
    string Title,
    DateTimeOffset StartedAt,
    DateOnly Date,
    int? DurationMinutes,
    List<HevyExercise> Exercises);
