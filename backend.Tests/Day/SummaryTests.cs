public class SummaryTests
{
    private static async Task LogAFullDayAsync(HttpClient client, string date)
    {
        await client.PostAsJsonAsync("/api/weight", new { date, weightKg = 84.0, waistCm = 83 });
        await client.PostAsJsonAsync("/api/nutrition", new
        {
            date, kcal = 2033, proteinG = 176, carbsG = 197, fatG = 56,
            waterL = 3.5, coffeeMl = 500, lastCoffee = "09:30",
        });
        await client.PostAsJsonAsync("/api/activity", new { date, steps = 10000, cardio = true, cardioMinutes = 30 });
        await client.PostAsJsonAsync("/api/sleep", new { date, timeInBedMinutes = 450, actualSleepMinutes = 420, quality = 70 });
        await client.PostAsJsonAsync("/api/wellbeing", new { date, hunger = 2, energy = 3, notes = "Zone 2" });
    }

    [Fact]
    public async Task Summary_RendersEverySectionOfTheDay()
    {
        using var app = await TestApp.SignedInAsync();
        await LogAFullDayAsync(app.Client, "2026-08-17");

        var text = await app.Client.GetStringAsync("/api/summary/2026-08-17");

        Assert.StartsWith("Tageslog 17.08.2026 (Montag)", text);
        Assert.Contains("Gewicht: 84 kg", text);
        Assert.Contains("Taille: 83 cm", text);
        Assert.Contains("Protein: 176 g · Kohlenhydrate: 197 g · Fett: 56 g", text);
        Assert.Contains("Wasser: 3,5 L", text);
        Assert.Contains("Kaffee: 500 ml (letzter um 09:30)", text);
        Assert.Contains("Schritte: 10.000", text);
        Assert.Contains("Cardio: ja, 30 min", text);
        Assert.Contains("Im Bett: 7h 30min · Tatsächlich: 7h 00min · Qualität: 70 %", text);
        Assert.Contains("Hunger: 2/5 · Energie: 3/5", text);
        Assert.Contains("Notizen", text);
        Assert.Contains("Zone 2", text);
    }

    [Fact]
    public async Task Summary_LeavesOutSectionsWithNothingInThem()
    {
        using var app = await TestApp.SignedInAsync();
        await app.Client.PostAsJsonAsync("/api/weight", new { date = "2026-08-17", weightKg = 84.0 });

        var text = await app.Client.GetStringAsync("/api/summary/2026-08-17");

        Assert.Contains("Körper", text);
        Assert.DoesNotContain("Ernährung", text);
        Assert.DoesNotContain("Schlaf", text);
        Assert.DoesNotContain("Befinden", text);
    }

    [Fact]
    public async Task Summary_CallsADayWithoutTrainingARestday()
    {
        using var app = await TestApp.SignedInAsync();

        var text = await app.Client.GetStringAsync("/api/summary/2026-08-17");

        Assert.Contains("Restday", text);
    }

    [Fact]
    public async Task Summary_IsPlainTextWithoutMarkdownMarkers()
    {
        using var app = await TestApp.SignedInAsync();
        await LogAFullDayAsync(app.Client, "2026-08-17");

        var text = await app.Client.GetStringAsync("/api/summary/2026-08-17");

        Assert.DoesNotContain("**", text);
        Assert.DoesNotContain("## ", text);
        Assert.DoesNotContain("- ", text);
    }

    [Fact]
    public async Task Summary_RejectsAnUnparseableDate()
    {
        using var app = await TestApp.SignedInAsync();

        var res = await app.Client.GetAsync("/api/summary/not-a-date");

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }
}
