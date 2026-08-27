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
    private readonly WeekReviewService _review;

    public SummaryController(AppDbContext db, UserManager<AppUser> users, WeekReviewService review)
    {
        _db = db;
        _users = users;
        _review = review;
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
        var note = await _db.DayNotes.FirstOrDefaultAsync(n => n.UserId == UserId && n.Date == day);
        var workouts = await _db.WorkoutLogs
            .Where(w => w.UserId == UserId && w.Date == day)
            .OrderBy(w => w.StartedAt)
            .ToListAsync();

        var text = Render(day, weight, food, move, sleep, note, workouts);
        return Content(text, "text/plain; charset=utf-8");
    }

    /// <summary>
    /// The week against the week before it, as numbers rather than as text.
    ///
    /// Beside the plain-text week log rather than instead of it: that one is
    /// for pasting somewhere, this one is for reading. Rendered by the client,
    /// which already speaks both languages.
    /// </summary>
    [HttpGet("week/{date}/review")]
    public async Task<IActionResult> Review(string date, CancellationToken ct)
    {
        if (!DateOnly.TryParse(date, out var anyDay)) return BadRequest("Invalid date.");
        return Ok(await _review.BuildAsync(UserId, anyDay, ct));
    }

    /// <summary>
    /// A whole week as one text: a line per day for the numbers that vary daily,
    /// then the averages. Meant to be pasted somewhere as a single block rather
    /// than seven separate day exports.
    /// </summary>
    [HttpGet("week/{date}")]
    public async Task<IActionResult> Week(string date)
    {
        if (!DateOnly.TryParse(date, out var anyDay)) return BadRequest("Invalid date.");

        // Weeks run Monday to Sunday, whichever day was asked for.
        var monday = anyDay.AddDays(-(((int)anyDay.DayOfWeek + 6) % 7));
        var sunday = monday.AddDays(6);

        var weight = await _db.WeightEntries.Where(e => e.UserId == UserId && e.Date >= monday && e.Date <= sunday).ToListAsync();
        var food = await _db.NutritionEntries.Where(e => e.UserId == UserId && e.Date >= monday && e.Date <= sunday).ToListAsync();
        var move = await _db.ActivityEntries.Where(e => e.UserId == UserId && e.Date >= monday && e.Date <= sunday).ToListAsync();
        var sleep = await _db.SleepEntries.Where(e => e.UserId == UserId && e.Date >= monday && e.Date <= sunday).ToListAsync();
        var workouts = await _db.WorkoutLogs.Where(w => w.UserId == UserId && w.Date >= monday && w.Date <= sunday).ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine($"Wochenlog {monday.ToString("dd.MM.", De)}–{sunday.ToString("dd.MM.yyyy", De)}");

        for (var day = monday; day <= sunday; day = day.AddDays(1))
        {
            var w = weight.FirstOrDefault(e => e.Date == day);
            var n = food.FirstOrDefault(e => e.Date == day);
            var a = move.FirstOrDefault(e => e.Date == day);
            var sl = sleep.FirstOrDefault(e => e.Date == day);
            var training = workouts.Where(x => x.Date == day).Select(x => x.Title).ToList();

            var parts = new[]
            {
                w?.WeightKg is decimal kg ? $"{Num(kg)} kg" : null,
                n?.Kcal is int kcal ? $"{kcal} kcal" : null,
                n?.ProteinG is int p ? $"{p} g P" : null,
                a?.Steps is int steps ? $"{Thousands(steps)} Schritte" : null,
                sl?.ActualSleepMinutes is int asleep ? $"{Hm(asleep)} Schlaf" : null,
                training.Count > 0 ? string.Join(" + ", training) : null,
            }.OfType<string>().ToList();

            sb.AppendLine();
            sb.AppendLine($"{De.DateTimeFormat.GetAbbreviatedDayName(day.DayOfWeek)} {day.ToString("dd.MM.", De)}");
            sb.AppendLine(parts.Count > 0 ? "  " + string.Join(" · ", parts) : "  —");
        }

        string? Avg<T>(IEnumerable<T> source, Func<T, decimal?> pick, string unit, int digits = 0)
        {
            var values = source.Select(pick).OfType<decimal>().ToList();
            if (values.Count == 0) return null;
            var mean = Math.Round(values.Average(), digits);
            // N0/N1 rather than 0/0.#, so a step average reads 10.308 like
            // every other count in the text.
            return $"{mean.ToString(digits > 0 ? $"N{digits}" : "N0", De)}{unit}";
        }

        var averages = new[]
        {
            Avg(food, e => e.Kcal, " kcal") is string k ? $"Kalorien: {k}" : null,
            Avg(food, e => e.ProteinG, " g") is string p2 ? $"Protein: {p2}" : null,
            Avg(move, e => e.Steps, "") is string st ? $"Schritte: {st}" : null,
            sleep.Select(e => e.ActualSleepMinutes ?? e.TimeInBedMinutes).OfType<int>().ToList() is { Count: > 0 } mins
                ? $"Schlaf: {Hm((int)Math.Round(mins.Average()))}"
                : null,
            Avg(weight, e => e.WeightKg, " kg", 1) is string w2 ? $"Gewicht: {w2}" : null,
        }.OfType<string>().ToList();

        sb.AppendLine();
        sb.AppendLine("Schnitt");
        foreach (var line in averages) sb.AppendLine("  " + line);
        sb.AppendLine($"  Training: {workouts.Count} Einheiten · {workouts.Sum(x => x.SetCount)} Sätze"
            + $" · {Thousands((int)Math.Round(workouts.Sum(x => x.VolumeKg)))} kg");
        var cardioDays = move.Count(x => x.Cardio == true);
        sb.AppendLine($"  Cardio: {cardioDays} {(cardioDays == 1 ? "Tag" : "Tage")}");

        return Content(sb.ToString().TrimEnd() + "\n", "text/plain; charset=utf-8");
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
        DayNote? note,
        List<WorkoutLog> workouts)
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
        }.OfType<string>().ToList();
        Section("Schlaf", sleepParts.Count > 0 ? new[] { string.Join(" · ", sleepParts) } : []);


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

        // The note has a row of its own; the older per-entry notes are still
        // read so days written before that are not silently dropped.
        var notes = new[] { note?.Text, weight?.Notes, sleep?.Notes }
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .SelectMany(n => n!.Trim().Split('\n'))
            .Select(line => line.Trim())
            .Where(line => line.Length > 0)
            .ToList();

        if (notes.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("Notizen");
            foreach (var line in notes) sb.AppendLine("  " + line);
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
