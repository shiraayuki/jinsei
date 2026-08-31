using System.Text;
using System.Text.Json;

/// <summary>
/// Minimal client for the Gemini API. Only one call is needed — an image plus a
/// prompt, answered under a JSON schema — so this talks HTTP directly instead
/// of pulling in an SDK.
/// </summary>
public class GeminiClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;

    public GeminiClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        _config = config;
        // A screenshot with thinking enabled measured at ~80s for a trivial
        // read; a real screenshot with more to reason about runs longer, so
        // this needs real headroom rather than the "a few seconds" a plain
        // text call would need.
        _http.Timeout = TimeSpan.FromSeconds(150);
    }

    private string? ApiKey => _config["Gemini:ApiKey"] is { Length: > 0 } key ? key : null;

    public bool IsConfigured => ApiKey is not null;

    private string Model => _config["Gemini:Model"] is { Length: > 0 } m ? m : "gemini-3.6-flash";

    private string BaseUrl => (_config["Gemini:BaseUrl"] ?? "https://generativelanguage.googleapis.com").TrimEnd('/');

    /// <summary>
    /// Sends one image and one instruction, and returns the model's answer as
    /// the raw JSON text it was constrained to produce.
    /// </summary>
    public async Task<string> ReadImageAsync(
        string base64Image,
        string mediaType,
        string systemInstruction,
        string prompt,
        object responseSchema,
        CancellationToken ct = default)
    {
        if (ApiKey is null)
            throw new GeminiException("Gemini ist nicht konfiguriert: setze Gemini:ApiKey.");

        var body = new
        {
            system_instruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new object[]
                    {
                        new { inline_data = new { mime_type = mediaType, data = base64Image } },
                        new { text = prompt },
                    },
                },
            },
            generationConfig = new
            {
                responseMimeType = "application/json",
                responseSchema,
            },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1beta/models/{Model}:generateContent")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };
        // The key goes in a header rather than the query string so it cannot
        // end up in a proxy or server log.
        req.Headers.Add("x-goog-api-key", ApiKey);

        HttpResponseMessage res;
        try
        {
            res = await _http.SendAsync(req, ct);
        }
        catch (HttpRequestException exc)
        {
            throw new GeminiException($"Gemini ist nicht erreichbar: {exc.Message}", exc);
        }
        catch (TaskCanceledException exc) when (!ct.IsCancellationRequested)
        {
            throw new GeminiException("Gemini hat nicht rechtzeitig geantwortet.", exc);
        }

        var payload = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
            throw new GeminiException($"Gemini antwortete mit {(int)res.StatusCode}: {Describe(payload)}");

        return ExtractText(payload);
    }

    /// <summary>Pulls the message out of an error body so the client sees something useful.</summary>
    private static string Describe(string payload)
    {
        try
        {
            var root = JsonSerializer.Deserialize<JsonElement>(payload);
            if (root.TryGetProperty("error", out var error) && error.TryGetProperty("message", out var message))
                return message.GetString() ?? payload;
        }
        catch (JsonException)
        {
            // Not every failure comes back as JSON.
        }
        return payload.Length > 400 ? payload[..400] : payload;
    }

    /// <summary>Digs the generated text out of the first candidate's parts.</summary>
    private static string ExtractText(string payload)
    {
        JsonElement root;
        try
        {
            root = JsonSerializer.Deserialize<JsonElement>(payload);
        }
        catch (JsonException exc)
        {
            throw new GeminiException($"Antwort war kein JSON: {exc.Message}", exc);
        }

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.ValueKind != JsonValueKind.Array
            || candidates.GetArrayLength() == 0)
            throw new GeminiException($"Antwort hatte keine Kandidaten: {Describe(payload)}");

        var first = candidates[0];
        if (!first.TryGetProperty("content", out var content)
            || !content.TryGetProperty("parts", out var parts) || parts.ValueKind != JsonValueKind.Array)
            throw new GeminiException($"Antwort hatte keinen Inhalt: {Describe(payload)}");

        var text = string.Concat(parts.EnumerateArray()
            .Where(part => part.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String)
            .Select(part => part.GetProperty("text").GetString()!));

        if (string.IsNullOrWhiteSpace(text))
            throw new GeminiException($"Antwort enthielt keinen Text: {Describe(payload)}");

        return text;
    }
}

public class GeminiException : Exception
{
    public GeminiException(string message, Exception? inner = null) : base(message, inner) { }
}
