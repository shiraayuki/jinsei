using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Every row this app holds about you, in a file you can open.
///
/// The whole point of running it yourself is that the data is yours, and until
/// now the only way to that data was pg_dump over SSH — which is a claim, not
/// an export. One area per request, CSV for a spreadsheet and JSON for
/// anything else, plus a bundle of the lot.
///
/// Each area is declared once, as a header and a row shape, and both formats
/// are rendered from that: a column added to the CSV cannot go missing from the
/// JSON, because neither is written by hand.
/// </summary>
[ApiController]
[Route("api/export")]
[Authorize]
public class ExportController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public ExportController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    /// <summary>A table on its way out: the column names and the rows under them.</summary>
    private sealed record Table(string[] Columns, IReadOnlyList<object?[]> Rows);

    /// <summary>The areas that can be exported, in the order they are offered.</summary>
    public static readonly string[] Areas =
        ["weight", "sleep", "nutrition", "activity", "workouts", "habits", "notes"];

    [HttpGet("{area}")]
    public async Task<IActionResult> Export(string area, [FromQuery] string format = "json")
    {
        var csv = string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase);
        if (!csv && !string.Equals(format, "json", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Unknown format. Use csv or json.");

        var today = DateOnly.FromDateTime(DateTime.Today).ToString("yyyy-MM-dd");

        // The bundle is one file with every area in it, which is the shape you
        // want when the point is "all of it". A spreadsheet has no way to hold
        // seven tables in one sheet, so it stays JSON.
        if (string.Equals(area, "all", StringComparison.OrdinalIgnoreCase))
        {
            if (csv) return BadRequest("The bundle is JSON only; export areas one at a time for CSV.");

            var bundle = new Dictionary<string, object?>
            {
                ["exportedAt"] = DateTimeOffset.UtcNow.ToString("o"),
                ["profile"] = await ProfileAsync(),
            };
            foreach (var name in Areas)
                bundle[name] = AsObjects(await TableAsync(name) ?? new Table([], []));

            return File(JsonBytes(bundle), "application/json; charset=utf-8", $"jinsei-{today}.json");
        }

        var table = await TableAsync(area);
        if (table is null) return NotFound($"Unknown area. One of: {string.Join(", ", Areas)}, all.");

        return csv
            ? File(CsvBytes(table), "text/csv; charset=utf-8", $"jinsei-{area}-{today}.csv")
            : File(JsonBytes(AsObjects(table)), "application/json; charset=utf-8", $"jinsei-{area}-{today}.json");
    }

    private async Task<Table?> TableAsync(string area) => area.ToLowerInvariant() switch
    {
        "weight" => await WeightAsync(),
        "sleep" => await SleepAsync(),
        "nutrition" => await NutritionAsync(),
        "activity" => await ActivityAsync(),
        "workouts" => await WorkoutsAsync(),
        "habits" => await HabitsAsync(),
        "notes" => await NotesAsync(),
        _ => null,
    };

    private async Task<Table> WeightAsync()
    {
        var rows = await _db.WeightEntries
            .Where(e => e.UserId == UserId)
            .OrderBy(e => e.Date)
            .ToListAsync();

        return new Table(
            ["date", "weight_kg", "waist_cm", "notes", "logged_at"],
            rows.Select(e => new object?[] { e.Date, e.WeightKg, e.WaistCm, e.Notes, e.LoggedAt }).ToList());
    }

    private async Task<Table> SleepAsync()
    {
        var rows = await _db.SleepEntries
            .Where(e => e.UserId == UserId)
            .OrderBy(e => e.Date)
            .ToListAsync();

        return new Table(
            [
                "date", "bed_time", "wake_time", "time_in_bed_minutes", "actual_sleep_minutes",
                "sleep_onset_minutes", "awake_minutes", "light_minutes", "rem_minutes", "deep_minutes",
                "notes", "logged_at",
            ],
            rows.Select(e => new object?[]
            {
                e.Date, e.BedTime, e.WakeTime, e.TimeInBedMinutes, e.ActualSleepMinutes,
                e.SleepOnsetMinutes, e.AwakeMinutes, e.LightMinutes, e.RemMinutes, e.DeepMinutes,
                e.Notes, e.LoggedAt,
            }).ToList());
    }

    private async Task<Table> NutritionAsync()
    {
        var rows = await _db.NutritionEntries
            .Where(e => e.UserId == UserId)
            .OrderBy(e => e.Date)
            .ToListAsync();

        return new Table(
            ["date", "kcal", "protein_g", "carbs_g", "fat_g", "water_l", "coffee_ml", "last_coffee", "notes", "logged_at"],
            rows.Select(e => new object?[]
            {
                e.Date, e.Kcal, e.ProteinG, e.CarbsG, e.FatG, e.WaterL, e.CoffeeMl, e.LastCoffee, e.Notes, e.LoggedAt,
            }).ToList());
    }

    private async Task<Table> ActivityAsync()
    {
        var rows = await _db.ActivityEntries
            .Where(e => e.UserId == UserId)
            .OrderBy(e => e.Date)
            .ToListAsync();

        return new Table(
            ["date", "steps", "cardio", "cardio_minutes", "logged_at"],
            rows.Select(e => new object?[] { e.Date, e.Steps, e.Cardio, e.CardioMinutes, e.LoggedAt }).ToList());
    }

    /// <summary>
    /// The sessions, with the parsed payload alongside them: it is the only
    /// place every individual set lives, so an export without it would hand
    /// over the summary and keep the training.
    /// </summary>
    private async Task<Table> WorkoutsAsync()
    {
        var rows = await _db.WorkoutLogs
            .Where(e => e.UserId == UserId)
            .OrderBy(e => e.Date)
            .ToListAsync();

        return new Table(
            [
                "date", "started_at", "title", "source", "external_id", "duration_minutes",
                "exercise_count", "set_count", "volume_kg", "exercises", "synced_at",
            ],
            rows.Select(e => new object?[]
            {
                e.Date, e.StartedAt, e.Title, e.Source, e.ExternalId, e.DurationMinutes,
                e.ExerciseCount, e.SetCount, e.VolumeKg, new RawJson(e.PayloadJson), e.SyncedAt,
            }).ToList());
    }

    /// <summary>
    /// A habit and its ticks in one table rather than two: the entry rows are
    /// meaningless without the name beside them, and two files that have to be
    /// joined on a GUID is not an export anyone opens.
    /// </summary>
    private async Task<Table> HabitsAsync()
    {
        var habits = await _db.Habits
            .Where(h => h.UserId == UserId)
            .Include(h => h.Entries)
            .OrderBy(h => h.Name)
            .ToListAsync();

        var rows = habits
            .SelectMany(h => h.Entries
                .OrderBy(e => e.Date)
                .Select(e => new object?[]
                {
                    e.Date, h.Name, h.Archived, e.CompletedCount, e.Notes, e.LoggedAt,
                }))
            .OrderBy(r => (DateOnly)r[0]!)
            .ToList();

        return new Table(["date", "habit", "archived", "completed_count", "notes", "logged_at"], rows);
    }

    private async Task<Table> NotesAsync()
    {
        var rows = await _db.DayNotes
            .Where(e => e.UserId == UserId)
            .OrderBy(e => e.Date)
            .ToListAsync();

        return new Table(
            ["date", "text", "logged_at"],
            rows.Select(e => new object?[] { e.Date, e.Text, e.LoggedAt }).ToList());
    }

    /// <summary>
    /// The goals and settings the numbers were logged against. Keyed the same
    /// way the tables are, so the whole file speaks one convention rather than
    /// one per block.
    /// </summary>
    private async Task<object> ProfileAsync()
    {
        var user = await _db.Users.FirstAsync(u => u.Id == UserId);
        return new Dictionary<string, object?>
        {
            ["email"] = user.Email,
            ["display_name"] = user.DisplayName,
            ["language"] = user.Language,
            ["kcal_goal"] = user.KcalGoal,
            ["protein_goal"] = user.ProteinGoal,
            ["water_goal_l"] = user.WaterGoalL,
            ["steps_goal"] = user.StepsGoal,
            ["sleep_goal_minutes"] = user.SleepGoalMinutes,
            ["weight_goal_kg"] = user.WeightGoalKg,
            ["weekly_workouts_goal"] = user.WeeklyWorkoutsGoal,
            ["weekly_sets_goal"] = user.WeeklySetsGoal,
            ["weekly_rate_percent"] = user.WeeklyRatePercent,
        };
    }

    /// <summary>A value that is already JSON and must not be quoted again.</summary>
    private sealed record RawJson(string Json);

    private static IReadOnlyList<Dictionary<string, object?>> AsObjects(Table table) =>
        table.Rows
            .Select(row => table.Columns
                .Select((column, i) => (column, value: JsonValue(row[i])))
                .ToDictionary(pair => pair.column, pair => pair.value))
            .ToList();

    /// <summary>
    /// What a cell becomes in JSON: dates and times as the strings the rest of
    /// the API speaks, and an already-serialised payload parsed back so it
    /// lands as a nested array rather than a string full of escapes.
    /// </summary>
    private static object? JsonValue(object? value) => value switch
    {
        null => null,
        DateOnly d => d.ToString("yyyy-MM-dd"),
        TimeOnly t => t.ToString("HH:mm"),
        DateTimeOffset ts => ts.ToString("o", CultureInfo.InvariantCulture),
        RawJson raw => ParseOrNull(raw.Json),
        _ => value,
    };

    private static JsonElement? ParseOrNull(string json)
    {
        try { return JsonDocument.Parse(json).RootElement.Clone(); }
        catch (JsonException) { return null; }
    }

    private static byte[] JsonBytes(object payload) =>
        JsonSerializer.SerializeToUtf8Bytes(payload, new JsonSerializerOptions { WriteIndented = true });

    /// <summary>
    /// RFC 4180: CRLF between records, quotes doubled inside a quoted field,
    /// and a field quoted as soon as it holds a comma, a quote or a newline —
    /// which a note regularly does.
    /// </summary>
    private static byte[] CsvBytes(Table table)
    {
        var sb = new StringBuilder();
        sb.Append(string.Join(',', table.Columns.Select(Escape))).Append("\r\n");
        foreach (var row in table.Rows)
            sb.Append(string.Join(',', row.Select(cell => Escape(CsvValue(cell))))).Append("\r\n");

        // The BOM is for one reader only: Excel opens a UTF-8 CSV as the local
        // code page without it, and turns every note with an umlaut in it to
        // mojibake.
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(sb.ToString())];
    }

    private static string CsvValue(object? value) => value switch
    {
        null => "",
        DateOnly d => d.ToString("yyyy-MM-dd"),
        TimeOnly t => t.ToString("HH:mm"),
        DateTimeOffset ts => ts.ToString("o", CultureInfo.InvariantCulture),
        bool b => b ? "true" : "false",
        RawJson raw => raw.Json,
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString() ?? "",
    };

    private static string Escape(string value) =>
        value.AsSpan().IndexOfAny(",\"\r\n") >= 0
            ? $"\"{value.Replace("\"", "\"\"")}\""
            : value;
}
