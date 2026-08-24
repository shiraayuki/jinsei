using Microsoft.Extensions.Configuration;

/// <summary>
/// Sends real screenshots through the real model. Skipped unless both
/// GEMINI_API_KEY and JINSEI_SCREENSHOT_DIR are set, because it costs money
/// and needs images that are deliberately not in the repository:
///
///   JINSEI_SCREENSHOT_DIR/sleep.png      — a Sleep Cycle day
///   JINSEI_SCREENSHOT_DIR/nutrition.png  — a FatSecret "Nährstoffe" tab
///
/// The expectations are passed in alongside, so this checks the prompt rather
/// than any one screenshot:
///
///   JINSEI_SLEEP_EXPECT=inBed,asleep,quality,date
///   JINSEI_NUTRITION_EXPECT=kcal,protein,carbs,fat,date
/// </summary>
public class ScreenshotImportLiveTests
{
    private static string? Dir => Environment.GetEnvironmentVariable("JINSEI_SCREENSHOT_DIR");
    private static string? Key => Environment.GetEnvironmentVariable("GEMINI_API_KEY");

    private static bool Enabled(string expectVar) =>
        !string.IsNullOrEmpty(Dir)
        && !string.IsNullOrEmpty(Key)
        && !string.IsNullOrEmpty(Environment.GetEnvironmentVariable(expectVar));

    private static ScreenshotImportService Service()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Gemini:ApiKey"] = Key,
                ["Gemini:Model"] = Environment.GetEnvironmentVariable("GEMINI_MODEL") ?? "gemini-3.6-flash",
            })
            .Build();
        return new ScreenshotImportService(new GeminiClient(new HttpClient(), config));
    }

    private static async Task<ImportDraft> ReadAsync(string kind, string file, DateOnly contextDate)
    {
        var bytes = await File.ReadAllBytesAsync(Path.Combine(Dir!, file));
        var mediaType = Path.GetExtension(file) is ".png" ? "image/png" : "image/jpeg";
        return await Service().ExtractAsync(kind, Convert.ToBase64String(bytes), mediaType, contextDate);
    }

    private static int?[] Expected(string variable) =>
        Environment.GetEnvironmentVariable(variable)!
            .Split(',')
            .Select(p => p.Trim() is { Length: > 0 } v && int.TryParse(v, out var n) ? n : (int?)null)
            .ToArray();

    [Fact]
    public async Task ReadsASleepCycleScreenshot()
    {
        // Passes vacuously when the environment is not set up; xunit has no
        // skip at runtime without pulling in another package.
        if (!Enabled("JINSEI_SLEEP_EXPECT")) return;

        var expect = Expected("JINSEI_SLEEP_EXPECT");
        var draft = await ReadAsync("sleep", "sleep.png", new DateOnly(2026, 8, 24));

        Assert.Equal(expect[0], (int?)draft.Fields["timeInBedMinutes"]);
        Assert.Equal(expect[1], (int?)draft.Fields["actualSleepMinutes"]);
        Assert.Equal(expect[2], (int?)draft.Fields["quality"]);
        Assert.Equal(Environment.GetEnvironmentVariable("JINSEI_SLEEP_EXPECT")!.Split(',')[3].Trim(), draft.Date?.ToString("yyyy-MM-dd"));
    }

    [Fact]
    public async Task ReadsAFatSecretScreenshot()
    {
        if (!Enabled("JINSEI_NUTRITION_EXPECT")) return;

        var expect = Expected("JINSEI_NUTRITION_EXPECT");
        var draft = await ReadAsync("nutrition", "nutrition.png", new DateOnly(2026, 8, 24));

        Assert.Equal(expect[0], (int?)draft.Fields["kcal"]);
        Assert.Equal(expect[1], (int?)draft.Fields["proteinG"]);
        Assert.Equal(expect[2], (int?)draft.Fields["carbsG"]);
        Assert.Equal(expect[3], (int?)draft.Fields["fatG"]);
        Assert.Equal(Environment.GetEnvironmentVariable("JINSEI_NUTRITION_EXPECT")!.Split(',')[4].Trim(), draft.Date?.ToString("yyyy-MM-dd"));
    }
}
