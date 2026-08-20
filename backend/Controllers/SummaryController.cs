using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Renders a day as plain text for pasting elsewhere. Built on the server so
/// the whole day is assembled in one query pass and the client does not have to
/// hold every feature's data just to print it.
/// </summary>
[ApiController]
[Route("api/summary")]
[Authorize]
public class SummaryController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public SummaryController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    private static readonly CultureInfo De = CultureInfo.GetCultureInfo("de-DE");

    [HttpGet("{date}")]
    public async Task<IActionResult> Get(string date)
    {
        if (!DateOnly.TryParse(date, out var day)) return BadRequest("Invalid date.");

        var weight = await _db.WeightEntries.FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == day);
        var food = await _db.NutritionEntries.FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == day);
        var move = await _db.ActivityEntries.FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == day);
        var sleep = await _db.SleepEntries.FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == day);
        var feel = await _db.WellbeingEntries.FirstOrDefaultAsync(e => e.UserId == UserId && e.Date == day);
        var workouts = await _db.WorkoutLogs
            .Where(w => w.UserId == UserId && w.Date == day)
            .OrderBy(w => w.StartedAt)
            .ToListAsync();

        var habits = await _db.Habits
            .Where(h => h.UserId == UserId && !h.Archived)
            .Select(h => new
            {
                h.Name,
                Done = h.Entries.Any(e => e.Date == day && e.CompletedCount > 0),
            })
            .ToListAsync();

        var text = Render(day, weight, food, move, sleep, feel, workouts, habits.Select(h => (h.Name, h.Done)).ToList());
        return Content(text, "text/plain; charset=utf-8");
    }

    private static string Num(decimal value) =>
        value == Math.Truncate(value)
            ? ((int)value).ToString(De)
            : value.ToString("0.##", De);

    private static string Thousands(int value) => value.ToString("N0", De);

    private static string Hm(int minutes) => $"{minutes / 60}h {minutes % 60:00}min";

    private static string Render(
        DateOnly day,
        WeightEntry? weight,
        NutritionEntry? food,
        ActivityEntry? move,
        SleepEntry? sleep,
        WellbeingEntry? feel,
        List<WorkoutLog> workouts,
        List<(string Name, bool Done)> habits)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Tageslog {day.ToString("dd.MM.yyyy", De)} ({De.DateTimeFormat.GetDayName(day.DayOfWeek)})");

        // Sections with nothing in them are left out entirely, so the text stays
        // as short as the day was.
        void Section(string title, IEnumerable<string> lines)
        {
            var body = lines.Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
            if (body.Count == 0) return;
            sb.AppendLine();
            sb.AppendLine(title);
            foreach (var line in body) sb.AppendLine("  " + line);
        }

        Section("Körper", new[]
        {
            weight?.WeightKg is decimal kg ? $"Gewicht: {Num(kg)} kg" : null,
            weight?.WaistCm is decimal cm ? $"Taille: {Num(cm)} cm" : null,
        }.OfType<string>());

        var macros = new[]
        {
            food?.ProteinG is int p ? $"Protein: {p} g" : null,
            food?.CarbsG is int c ? $"Kohlenhydrate: {c} g" : null,
            food?.FatG is int f ? $"Fett: {f} g" : null,
        }.OfType<string>().ToList();

        string? coffee = null;
        if (food?.CoffeeMl is int ml)
            coffee = food.LastCoffee is TimeOnly last
                ? $"Kaffee: {ml} ml (letzter um {last:HH:mm})"
                : $"Kaffee: {ml} ml";
        else if (food?.LastCoffee is TimeOnly only)
            coffee = $"Letzter Kaffee: {only:HH:mm}";

        Section("Ernährung", new[]
        {
            food?.Kcal is int kcal ? $"Kalorien: {kcal} kcal" : null,
            macros.Count > 0 ? string.Join(" · ", macros) : null,
            food?.WaterL is decimal water ? $"Wasser: {Num(water)} L" : null,
            coffee,
        }.OfType<string>());

        string? cardio = null;
        if (move?.Cardio == true)
            cardio = move.CardioMinutes is int min ? $"Cardio: ja, {min} min" : "Cardio: ja";
        else if (move?.Cardio == false)
            cardio = "Cardio: nein";

        Section("Aktivität", new[]
        {
            move?.Steps is int steps ? $"Schritte: {Thousands(steps)}" : null,
            cardio,
        }.OfType<string>());

        var sleepParts = new[]
        {
            sleep?.TimeInBedMinutes is int bed ? $"Im Bett: {Hm(bed)}" : null,
            sleep?.ActualSleepMinutes is int asleep ? $"Tatsächlich: {Hm(asleep)}" : null,
            sleep?.Quality is int q ? $"Qualität: {q} %" : null,
        }.OfType<string>().ToList();
        Section("Schlaf", sleepParts.Count > 0 ? new[] { string.Join(" · ", sleepParts) } : []);

        var feelParts = new[]
        {
            feel?.Hunger is int hunger ? $"Hunger: {hunger}/5" : null,
            feel?.Energy is int energy ? $"Energie: {energy}/5" : null,
        }.OfType<string>().ToList();
        Section("Befinden", feelParts.Count > 0 ? new[] { string.Join(" · ", feelParts) } : []);

        if (habits.Count > 0)
        {
            var done = habits.Where(h => h.Done).Select(h => h.Name).ToList();
            var open = habits.Where(h => !h.Done).Select(h => h.Name).ToList();
            Section("Habits", new[]
            {
                $"{done.Count}/{habits.Count} erledigt",
                done.Count > 0 ? "Erledigt: " + string.Join(", ", done) : null,
                open.Count > 0 ? "Offen: " + string.Join(", ", open) : null,
            }.OfType<string>());
        }

        if (workouts.Count == 0)
        {
            sb.AppendLine();
            sb.AppendLine("Training");
            sb.AppendLine("  Restday");
        }
        else
        {
            foreach (var w in workouts)
            {
                sb.AppendLine();
                sb.AppendLine($"Training — {w.Title}");
                foreach (var line in RenderExercises(w)) sb.AppendLine("  " + line);
                sb.AppendLine(
                    $"  Volumen: {w.ExerciseCount} Übungen · {w.SetCount} Sätze"
                    + $" · {Thousands((int)Math.Round(w.VolumeKg))} kg Gesamttonnage");
            }
        }

        if (!string.IsNullOrWhiteSpace(feel?.Notes))
        {
            sb.AppendLine();
            sb.AppendLine("Notizen");
            foreach (var line in feel!.Notes!.Trim().Split('\n'))
                sb.AppendLine("  " + line.Trim());
        }

        return sb.ToString().TrimEnd() + "\n";
    }

    /// <summary>One line per exercise, its sets joined the way they were logged.</summary>
    private static IEnumerable<string> RenderExercises(WorkoutLog w)
    {
        List<HevyExercise>? exercises = null;
        try
        {
            exercises = JsonSerializer.Deserialize<List<HevyExercise>>(
                w.PayloadJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException)
        {
            // Fall through to the stored text below.
        }

        if (exercises is null || exercises.Count == 0)
        {
            foreach (var line in w.RawText.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                yield return line.Trim();
            yield break;
        }

        foreach (var ex in exercises)
        {
            var sets = ex.Sets.Select(s =>
            {
                if (s.DurationSeconds is > 0) return $"{Math.Round(s.DurationSeconds.Value / 60.0, 1).ToString(De)} min";
                if (s.WeightKg is decimal kg && s.Reps is int reps) return $"{Num(kg)} kg x {reps}";
                if (s.WeightKg is decimal only) return $"{Num(only)} kg";
                return $"BW x {s.Reps ?? 0}";
            }).ToList();

            yield return sets.Count > 0 ? $"{ex.Name}: {string.Join(", ", sets)}" : ex.Name;
        }
    }
}
