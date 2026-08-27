using System.Globalization;
using System.Text.Json;

/// <summary>
/// Reads the numbers off a screenshot of Sleep Cycle or FatSecret so a day can
/// be confirmed instead of typed. The result is a draft: nothing is written
/// here, the client fills its form with it and the existing upsert endpoints
/// take it from there.
/// </summary>
public class ScreenshotImportService
{
    private readonly GeminiClient _gemini;

    public ScreenshotImportService(GeminiClient gemini)
    {
        _gemini = gemini;
    }

    public bool IsConfigured => _gemini.IsConfigured;

    public static bool IsSupportedKind(string kind) => kind is "sleep" or "nutrition";

    public static bool IsSupportedMediaType(string mediaType) =>
        mediaType is "image/png" or "image/jpeg" or "image/webp" or "image/gif";

    /// <summary>
    /// Sends the image to the model under a schema that only admits the fields the
    /// day actually stores, then range-checks what comes back.
    /// </summary>
    public async Task<ImportDraft> ExtractAsync(
        string kind,
        string base64Image,
        string mediaType,
        DateOnly contextDate,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new ScreenshotImportException("Gemini ist nicht konfiguriert: setze Gemini:ApiKey.");

        var (prompt, schema) = kind == "sleep"
            ? (SleepPrompt(contextDate), SleepSchema)
            : (NutritionPrompt(contextDate), NutritionSchema);

        string text;
        try
        {
            text = await _gemini.ReadImageAsync(base64Image, mediaType, SystemInstruction, prompt, schema, ct);
        }
        catch (GeminiException exc)
        {
            throw new ScreenshotImportException(exc.Message, exc);
        }

        JsonElement parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<JsonElement>(text);
        }
        catch (JsonException exc)
        {
            throw new ScreenshotImportException($"Antwort war kein JSON: {exc.Message}", exc);
        }

        return kind == "sleep"
            ? BuildSleepDraft(parsed, contextDate)
            : BuildNutritionDraft(parsed, contextDate);
    }

    // --- prompts -----------------------------------------------------------

    private const string SystemInstruction =
        "Du liest Zahlen aus einem Screenshot einer Gesundheits-App ab. "
        + "Gib ausschließlich zurück, was im Bild wirklich steht. Rate nie: was du "
        + "nicht sicher lesen kannst, ist null und gehört in lowConfidence.";

    private static string SleepPrompt(DateOnly contextDate) =>
        $"""
        Das ist ein Screenshot aus Sleep Cycle. Lies ab, was im Bild steht:

        - bedTime / wakeTime: die beiden Uhrzeiten unter der Schlafphasen-Kurve,
          als "HH:mm". Die linke ist das Zubettgehen, die rechte das Aufstehen
          (z. B. "20:49" und "04:52"). Stehen sie stattdessen als "Schlafen
          gegangen" und "Aufgewacht" in zwei Kacheln, nimm die.
        - awakeMinutes / lightMinutes / remMinutes / deepMinutes: die vier Zeiten
          aus der Legende unter der Kurve, jeweils in Minuten (1 h 44 min = 104).
          Die Legende heißt "Wach", "Leicht", "Traum" und "Tief" — "Traum" ist
          remMinutes. Fehlt eine Zeile, gib für sie null zurück.
        - timeInBedMinutes: "Zeit im Bett" als Minuten (7 h 35 min = 455). Steht
          das nicht im Bild, gib null zurück — die beiden Uhrzeiten sagen es
          schon, und die App rechnet es selbst aus.
        - actualSleepMinutes: "Schlaf" als Minuten, falls das Bild diese Zahl
          direkt nennt, sonst null. Nicht selbst addieren.
        - date: der Tag des Aufwachens im Format YYYY-MM-DD. Bei einer Nacht über
          zwei Tage ("So. 23-24. Aug.") ist das der spätere Tag. Steht kein Jahr
          im Bild, nimm das Jahr aus {contextDate:yyyy-MM-dd}. Ist kein Datum
          lesbar, gib null zurück.

        Prozentzahlen, Punktzahlen ("Sleep Score", "Routine", "Qualität") und
        die Effizienz interessieren nicht.

        notes: kurz auf Deutsch, was du gelesen hast oder was unklar war.
        """;

    private static string NutritionPrompt(DateOnly contextDate) =>
        $"""
        Das ist ein Screenshot aus FatSecret. Lies aus der Spalte "Gesamt" ab —
        niemals aus "Ziel" und niemals aus der Differenzspalte [+/-]:

        - kcal: Kalorien (kcal)
        - proteinG: Eiweiß (g)
        - carbsG: Kohlenhydrate (g)
        - fatG: Fett (g) — das Gesamtfett, nicht "Gesättigte Fette".
        - date: das Datum aus der Kopfzeile als YYYY-MM-DD. "22 Aug 26" heißt
          Tag Monat zweistelliges Jahr, also 2026-08-22. Bezugstag ist
          {contextDate:yyyy-MM-dd}. Ist kein Datum lesbar, gib null zurück.

        Wasser und Kaffee stehen nicht in diesem Screenshot; die bleiben null.

        notes: kurz auf Deutsch, was du gelesen hast oder was unklar war.
        """;

    // --- schemas -----------------------------------------------------------

    private static object NullableInt(string description) => new
    {
        type = new[] { "integer", "null" },
        description,
    };

    private static object NullableString(string description) => new
    {
        type = new[] { "string", "null" },
        description,
    };

    private static object Schema(object properties, string[] required) => new
    {
        type = "object",
        properties,
        required,
    };

    private static readonly object SleepSchema = Schema(
        new
        {
            date = NullableString("Aufwachtag als YYYY-MM-DD."),
            bedTime = NullableString("Zubettgehzeit als HH:mm."),
            wakeTime = NullableString("Aufstehzeit als HH:mm."),
            timeInBedMinutes = NullableInt("Zeit im Bett in Minuten."),
            actualSleepMinutes = NullableInt("Tatsächlicher Schlaf in Minuten."),
            awakeMinutes = NullableInt("Wachzeit in Minuten."),
            lightMinutes = NullableInt("Leichtschlaf in Minuten."),
            remMinutes = NullableInt("REM-/Traumschlaf in Minuten."),
            deepMinutes = NullableInt("Tiefschlaf in Minuten."),
            lowConfidence = new
            {
                type = "array",
                items = new { type = "string" },
                description = "Namen der Felder, die nur geraten sind.",
            },
            notes = NullableString("Kurze Notiz auf Deutsch."),
        },
        [
            "date", "bedTime", "wakeTime", "timeInBedMinutes", "actualSleepMinutes",
            "awakeMinutes", "lightMinutes", "remMinutes", "deepMinutes", "lowConfidence", "notes",
        ]);

    private static readonly object NutritionSchema = Schema(
        new
        {
            date = NullableString("Tag als YYYY-MM-DD."),
            kcal = NullableInt("Kalorien gesamt."),
            proteinG = NullableInt("Eiweiß in Gramm."),
            carbsG = NullableInt("Kohlenhydrate in Gramm."),
            fatG = NullableInt("Fett in Gramm."),
            lowConfidence = new
            {
                type = "array",
                items = new { type = "string" },
                description = "Namen der Felder, die nur geraten sind.",
            },
            notes = NullableString("Kurze Notiz auf Deutsch."),
        },
        ["date", "kcal", "proteinG", "carbsG", "fatG", "lowConfidence", "notes"]);

    // --- reading the answer back -------------------------------------------

    private static int? Int(JsonElement root, string name) =>
        root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var v)
            ? v
            : null;

    private static string? Str(JsonElement root, string name) =>
        root.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

    private static List<string> Strings(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var p) || p.ValueKind != JsonValueKind.Array) return [];
        return p.EnumerateArray()
            .Where(e => e.ValueKind == JsonValueKind.String)
            .Select(e => e.GetString()!)
            .ToList();
    }

    /// <summary>Keeps a value only while it is inside the range the day accepts.</summary>
    private static int? InRange(int? value, int min, int max, string field, List<string> warnings)
    {
        if (value is null) return null;
        if (value >= min && value <= max) return value;
        warnings.Add($"{field}: {value} liegt außerhalb des Erwartbaren und wurde verworfen.");
        return null;
    }

    private static DateOnly? ReadDate(JsonElement root, DateOnly contextDate, List<string> warnings)
    {
        var raw = Str(root, "date");
        if (raw is null) return null;
        if (!DateOnly.TryParse(raw, System.Globalization.CultureInfo.InvariantCulture, out var date))
        {
            warnings.Add($"Datum \"{raw}\" war nicht lesbar.");
            return null;
        }
        // A screenshot from another year is a misread year far more often than
        // it is a real backfill, so it gets flagged rather than silently used.
        if (Math.Abs(date.DayNumber - contextDate.DayNumber) > 365)
        {
            warnings.Add($"Datum {date:yyyy-MM-dd} ist mehr als ein Jahr entfernt und wurde verworfen.");
            return null;
        }
        return date;
    }

    private static ImportDraft BuildSleepDraft(JsonElement root, DateOnly contextDate)
    {
        var warnings = new List<string>();
        var bed = ReadClock(Str(root, "bedTime"), "Zubettgehzeit", warnings);
        var wake = ReadClock(Str(root, "wakeTime"), "Aufstehzeit", warnings);

        var awake = InRange(Int(root, "awakeMinutes"), 0, 1440, "Wach", warnings);
        var light = InRange(Int(root, "lightMinutes"), 0, 1440, "Leicht", warnings);
        var rem = InRange(Int(root, "remMinutes"), 0, 1440, "Traum", warnings);
        var deep = InRange(Int(root, "deepMinutes"), 0, 1440, "Tief", warnings);

        // The two clock times say how long the night was, so a screenshot that
        // only shows the curve still fills the duration in.
        var inBed = InRange(Int(root, "timeInBedMinutes"), 0, 1440, "Zeit im Bett", warnings)
            ?? SpanBetween(bed, wake);

        // Light, REM and deep are the sleep itself; awake is time in bed.
        var phases = new[] { light, rem, deep };
        var asleep = InRange(Int(root, "actualSleepMinutes"), 0, 1440, "Schlaf", warnings)
            ?? (phases.Any(p => p is not null) ? phases.Sum(p => p ?? 0) : null);

        // The upsert rejects this pair outright, so it is better caught here
        // where the field can still be emptied and pointed at.
        if (inBed is int minutes && asleep is int slept && slept > minutes)
        {
            warnings.Add("Gelesener Schlaf war länger als die Zeit im Bett — bitte prüfen.");
            asleep = null;
        }

        return new ImportDraft(
            Kind: "sleep",
            Date: ReadDate(root, contextDate, warnings),
            Fields: new Dictionary<string, object?>
            {
                ["bedTime"] = bed?.ToString("HH:mm"),
                ["wakeTime"] = wake?.ToString("HH:mm"),
                ["timeInBedMinutes"] = inBed,
                ["actualSleepMinutes"] = asleep,
                ["awakeMinutes"] = awake,
                ["lightMinutes"] = light,
                ["remMinutes"] = rem,
                ["deepMinutes"] = deep,
            },
            LowConfidence: Strings(root, "lowConfidence"),
            Warnings: warnings,
            Notes: Str(root, "notes"));
    }

    /// <summary>A clock time the model read, or null with a warning if it is not one.</summary>
    private static TimeOnly? ReadClock(string? value, string label, List<string> warnings)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (TimeOnly.TryParseExact(value.Trim(), ["HH:mm", "H:mm", "HH:mm:ss"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return time;

        warnings.Add($"{label} \"{value}\" war nicht lesbar.");
        return null;
    }

    /// <summary>Minutes from one clock time to the other, wrapping over midnight.</summary>
    private static int? SpanBetween(TimeOnly? from, TimeOnly? to)
    {
        if (from is not TimeOnly start || to is not TimeOnly end) return null;
        var minutes = (int)(end - start).TotalMinutes;
        if (minutes <= 0) minutes += 24 * 60;
        return minutes;
    }

    private static ImportDraft BuildNutritionDraft(JsonElement root, DateOnly contextDate)
    {
        var warnings = new List<string>();

        return new ImportDraft(
            Kind: "nutrition",
            Date: ReadDate(root, contextDate, warnings),
            Fields: new Dictionary<string, object?>
            {
                ["kcal"] = InRange(Int(root, "kcal"), 0, 20000, "Kalorien", warnings),
                ["proteinG"] = InRange(Int(root, "proteinG"), 0, 1000, "Eiweiß", warnings),
                ["carbsG"] = InRange(Int(root, "carbsG"), 0, 2000, "Kohlenhydrate", warnings),
                ["fatG"] = InRange(Int(root, "fatG"), 0, 1000, "Fett", warnings),
            },
            LowConfidence: Strings(root, "lowConfidence"),
            Warnings: warnings,
            Notes: Str(root, "notes"));
    }
}

/// <summary>What was read off the screenshot. Not stored — the client confirms it first.</summary>
public record ImportDraft(
    string Kind,
    DateOnly? Date,
    Dictionary<string, object?> Fields,
    List<string> LowConfidence,
    List<string> Warnings,
    string? Notes);

public class ScreenshotImportException : Exception
{
    public ScreenshotImportException(string message, Exception? inner = null) : base(message, inner) { }
}
