using System.Text.Json;
using Anthropic;
using Anthropic.Models.Messages;

/// <summary>
/// Reads the numbers off a screenshot of Sleep Cycle or FatSecret so a day can
/// be confirmed instead of typed. The result is a draft: nothing is written
/// here, the client fills its form with it and the existing upsert endpoints
/// take it from there.
/// </summary>
public class ScreenshotImportService
{
    private readonly IConfiguration _config;
    private AnthropicClient? _client;

    public ScreenshotImportService(IConfiguration config)
    {
        _config = config;
    }

    private string? ApiKey => _config["Anthropic:ApiKey"] is { Length: > 0 } key ? key : null;

    public bool IsConfigured => ApiKey is not null;

    private string Model => _config["Anthropic:Model"] is { Length: > 0 } m ? m : "claude-opus-5";

    private AnthropicClient Client => _client ??= new AnthropicClient { ApiKey = ApiKey };

    public static bool IsSupportedKind(string kind) => kind is "sleep" or "nutrition";

    public static bool IsSupportedMediaType(string mediaType) =>
        mediaType is "image/png" or "image/jpeg" or "image/webp" or "image/gif";

    /// <summary>
    /// Sends the image to Claude under a schema that only admits the fields the
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
            throw new ScreenshotImportException("Anthropic ist nicht konfiguriert: setze Anthropic:ApiKey.");

        var (prompt, schema) = kind == "sleep"
            ? (SleepPrompt(contextDate), SleepSchema)
            : (NutritionPrompt(contextDate), NutritionSchema);

        Message response;
        try
        {
            response = await Client.Messages.Create(new MessageCreateParams
            {
                Model = Model,
                MaxTokens = 2000,
                // The numbers are printed on the screen; there is nothing to
                // reason about, so the cheapest effort is also the fastest.
                OutputConfig = new OutputConfig
                {
                    Effort = Effort.Low,
                    Format = new JsonOutputFormat { Schema = schema },
                },
                System = "Du liest Zahlen aus einem Screenshot einer Gesundheits-App ab. "
                    + "Gib ausschließlich zurück, was im Bild wirklich steht. Rate nie: was du "
                    + "nicht sicher lesen kannst, ist null und gehört in lowConfidence.",
                Messages =
                [
                    new MessageParam
                    {
                        Role = Role.User,
                        Content = new List<ContentBlockParam>
                        {
                            new ImageBlockParam
                            {
                                Source = new Base64ImageSource
                                {
                                    Data = base64Image,
                                    MediaType = mediaType,
                                },
                            },
                            new TextBlockParam { Text = prompt },
                        },
                    },
                ],
            }, cancellationToken: ct);
        }
        catch (Exception exc) when (exc is not OperationCanceledException)
        {
            throw new ScreenshotImportException($"Auswertung fehlgeschlagen: {exc.Message}", exc);
        }

        var text = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
        if (string.IsNullOrWhiteSpace(text))
            throw new ScreenshotImportException("Das Modell hat nichts zurückgegeben.");

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

    private static string SleepPrompt(DateOnly contextDate) =>
        $"""
        Das ist ein Screenshot aus Sleep Cycle. Lies ab:

        - timeInBedMinutes: "Zeit im Bett" als Minuten (7 h 35 min = 455).
        - actualSleepMinutes: "Schlaf" als Minuten. Immer <= timeInBedMinutes.
        - quality: der Wert des Rings "Qualität" (0-100). Nicht der SLEEP SCORE
          und nicht "Dauer" oder "Routine". Steht keine "Qualität" im Bild, nimm
          den SLEEP SCORE und schreibe "quality" in lowConfidence.
        - date: der Tag des Aufwachens im Format YYYY-MM-DD. Bei einer Nacht über
          zwei Tage ("So. 23-24. Aug.") ist das der spätere Tag. Steht kein Jahr
          im Bild, nimm das Jahr aus {contextDate:yyyy-MM-dd}. Ist kein Datum
          lesbar, gib null zurück.

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

    private static JsonElement Json(object value) => JsonSerializer.SerializeToElement(value);

    private static object NullableInt(string description) => new
    {
        anyOf = new object[] { new { type = "integer" }, new { type = "null" } },
        description,
    };

    private static object NullableString(string description) => new
    {
        anyOf = new object[] { new { type = "string" }, new { type = "null" } },
        description,
    };

    private static Dictionary<string, JsonElement> Schema(object properties, string[] required) => new()
    {
        ["type"] = Json("object"),
        ["additionalProperties"] = Json(false),
        ["properties"] = Json(properties),
        ["required"] = Json(required),
    };

    private static readonly Dictionary<string, JsonElement> SleepSchema = Schema(
        new
        {
            date = NullableString("Aufwachtag als YYYY-MM-DD."),
            timeInBedMinutes = NullableInt("Zeit im Bett in Minuten."),
            actualSleepMinutes = NullableInt("Tatsächlicher Schlaf in Minuten."),
            quality = NullableInt("Schlafqualität 0-100."),
            lowConfidence = new
            {
                type = "array",
                items = new { type = "string" },
                description = "Namen der Felder, die nur geraten sind.",
            },
            notes = NullableString("Kurze Notiz auf Deutsch."),
        },
        ["date", "timeInBedMinutes", "actualSleepMinutes", "quality", "lowConfidence", "notes"]);

    private static readonly Dictionary<string, JsonElement> NutritionSchema = Schema(
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
        var inBed = InRange(Int(root, "timeInBedMinutes"), 0, 1440, "Zeit im Bett", warnings);
        var asleep = InRange(Int(root, "actualSleepMinutes"), 0, 1440, "Schlaf", warnings);
        var quality = InRange(Int(root, "quality"), 0, 100, "Qualität", warnings);

        // The upsert rejects this pair outright, so it is better caught here
        // where the field can still be emptied and pointed at.
        if (inBed is int bed && asleep is int slept && slept > bed)
        {
            warnings.Add("Gelesener Schlaf war länger als die Zeit im Bett — bitte prüfen.");
            asleep = null;
        }

        return new ImportDraft(
            Kind: "sleep",
            Date: ReadDate(root, contextDate, warnings),
            Fields: new Dictionary<string, object?>
            {
                ["timeInBedMinutes"] = inBed,
                ["actualSleepMinutes"] = asleep,
                ["quality"] = quality,
            },
            LowConfidence: Strings(root, "lowConfidence"),
            Warnings: warnings,
            Notes: Str(root, "notes"));
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
