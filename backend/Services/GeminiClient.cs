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
        // Reading a screenshot takes a few seconds; the default 100 is far more
        // than the request ever needs and would leave the browser hanging.
        _http.Timeout = TimeSpan.FromSeconds(60);
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
            model = Model,
            system_instruction = systemInstruction,
            input = new object[]
            {
                new { type = "image", data = base64Image, mime_type = mediaType },
                new { type = "text", text = prompt },
            },
            response_format = new
            {
                type = "text",
                mime_type = "application/json",
                schema = responseSchema,
            },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/v1beta/interactions")
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

    /// <summary>
    /// Digs the generated text out of the response. A completed interaction is
    /// a list of steps; the reasoning steps carry no text, so only the model
    /// output is collected.
    /// </summary>
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

        if (!root.TryGetProperty("steps", out var steps) || steps.ValueKind != JsonValueKind.Array)
            throw new GeminiException($"Antwort hatte keine Schritte: {Describe(payload)}");

        var text = string.Concat(steps.EnumerateArray()
            .Where(step => step.TryGetProperty("type", out var type) && type.GetString() == "model_output")
            .Where(step => step.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
            .SelectMany(step => step.GetProperty("content").EnumerateArray())
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
