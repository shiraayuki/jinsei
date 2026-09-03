using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Builds the day-by-day data block a headless Claude reads, then stores what
/// comes back.
///
/// The block is a compact table, not the verbose multi-line format
/// <see cref="SummaryController"/> renders for pasting elsewhere — 29 days of
/// that would burn tokens on formatting nobody reads. A day with nothing
/// logged simply has no line; a table with nothing at all in the window is
/// left out of the prompt entirely; the report is expected to say so itself
/// rather than the app pretending confidence it does not have.
/// </summary>
public class DailyReportService
{
    private readonly AppDbContext _db;
    private readonly ClaudeCliClient _claude;

    public DailyReportService(AppDbContext db, ClaudeCliClient claude)
    {
        _db = db;
        _claude = claude;
    }

    private const int WindowDays = 28;
    private static readonly CultureInfo De = new("de-AT");

    public async Task<DailyReport> GenerateAsync(
        string userId, DateOnly date, DailyReportSource source, CancellationToken ct = default)
    {
        var prompt = await BuildPromptAsync(userId, date, ct);
        var content = await _claude.RunAsync(prompt, ct);

        var existing = await _db.DailyReports.FirstOrDefaultAsync(r => r.UserId == userId && r.Date == date, ct);
        if (existing is null)
        {
            existing = new DailyReport { Id = Guid.NewGuid(), UserId = userId, Date = date };
            _db.DailyReports.Add(existing);
        }

        existing.Content = content;
        existing.Source = source;
        existing.GeneratedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return existing;
    }

    public async Task<string> BuildPromptAsync(string userId, DateOnly today, CancellationToken ct = default)
    {
        var from = today.AddDays(-WindowDays);

        var nutrition = await _db.NutritionEntries
            .Where(e => e.UserId == userId && e.Date >= from && e.Date <= today)
            .ToListAsync(ct);
        var activity = await _db.ActivityEntries
            .Where(e => e.UserId == userId && e.Date >= from && e.Date <= today)
            .ToListAsync(ct);
        var sleep = await _db.SleepEntries
            .Where(e => e.UserId == userId && e.Date >= from && e.Date <= today)
            .ToListAsync(ct);
        var weight = await _db.WeightEntries
            .Where(e => e.UserId == userId && e.Date >= from && e.Date <= today && e.WeightKg != null)
            .ToListAsync(ct);
        var workouts = await _db.WorkoutLogs
            .Where(w => w.UserId == userId && w.Date >= from && w.Date <= today)
            .ToListAsync(ct);
        var habits = await _db.HabitEntries
            .Where(h => h.Habit.UserId == userId && h.Date >= from && h.Date <= today)
            .Include(h => h.Habit)
            .ToListAsync(ct);

        var body = new StringBuilder();
        AppendSection(body, "Gewicht", weight.OrderBy(e => e.Date).Select(e =>
            $"{Day(e.Date)}: {e.WeightKg!.Value.ToString("0.0", De)}kg"));
        AppendSection(body, "Ernährung", nutrition.OrderBy(e => e.Date).Select(e => Nutrition(e)));
        AppendSection(body, "Aktivität", activity.OrderBy(e => e.Date).Select(e => Activity(e)));
        AppendSection(body, "Schlaf", sleep.OrderBy(e => e.Date).Select(e => Sleep(e)));
        AppendSection(body, "Training", workouts.OrderBy(w => w.Date).Select(w =>
            $"{Day(w.Date)}: {w.Title} ({w.SetCount} Sätze, {w.VolumeKg:0}kg Volumen)"));
        AppendSection(body, "Habits", habits.OrderBy(h => h.Date).Select(h =>
            $"{Day(h.Date)}: {h.Habit.Name}"));

        if (body.Length == 0)
            body.Append("(keine Daten im Zeitraum vorhanden)");

        return $"""
            Du bist ein nüchterner Trainings- und Gesundheitscoach. Du bekommst die
            Rohdaten der letzten {WindowDays} Tage sowie von heute für einen Nutzer.
            Schreibe einen kurzen Tagesbericht auf Deutsch mit genau diesen Abschnitten
            (als Überschriften):

            Zusammenfassung
            Auffälligkeiten
            Trend
            Empfehlung

            Regeln:
            - Nutze ausschließlich die unten gegebenen Daten, erfinde nichts.
            - Wenn Daten für einen Zeitraum fehlen oder spärlich sind, sag das offen
              statt eine Aussage zu erzwingen.
            - Halte dich kurz: insgesamt nicht mehr als ca. 200-300 Wörter.
            - Reiner Fließtext, keine Markdown-Formatierung (keine **, #, -, etc.).

            Daten der letzten {WindowDays} Tage (inkl. heute, {Day(today)}):

            {body}
            """;
    }

    private static void AppendSection(StringBuilder body, string title, IEnumerable<string> lines)
    {
        var list = lines.ToList();
        if (list.Count == 0) return;

        if (body.Length > 0) body.AppendLine().AppendLine();
        body.AppendLine($"{title}:");
        foreach (var line in list) body.AppendLine(line);
    }

    private static string Day(DateOnly date) => date.ToString("dd.MM", De);

    private static string Nutrition(NutritionEntry e)
    {
        var parts = new List<string>();
        if (e.Kcal is int kcal) parts.Add($"{kcal}kcal");
        if (e.ProteinG is int p) parts.Add($"{p}gP");
        if (e.WaterL is decimal w) parts.Add($"{w:0.0}L Wasser");
        return $"{Day(e.Date)}: {(parts.Count > 0 ? string.Join(" ", parts) : "(ohne Werte)")}";
    }

    private static string Activity(ActivityEntry e)
    {
        var parts = new List<string>();
        if (e.Steps is int steps) parts.Add($"{steps} Schritte");
        if (e.Cardio == true) parts.Add(e.CardioMinutes is int m ? $"{m}min Cardio" : "Cardio");
        return $"{Day(e.Date)}: {(parts.Count > 0 ? string.Join(" ", parts) : "(ohne Werte)")}";
    }

    private static string Sleep(SleepEntry e)
    {
        var minutes = e.ActualSleepMinutes ?? e.TimeInBedMinutes;
        var text = minutes is int m ? $"{m / 60}h{m % 60:00}" : "(ohne Werte)";
        return $"{Day(e.Date)}: {text} Schlaf";
    }
}
