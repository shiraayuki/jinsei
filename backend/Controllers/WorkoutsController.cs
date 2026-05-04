using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/workouts")]
[Authorize]
public class WorkoutsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public WorkoutsController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    // GET /api/workouts?from=&to=
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var query = _db.Workouts
            .Include(w => w.WorkoutExercises)
            .ThenInclude(we => we.Sets)
            .Where(w => w.UserId == UserId);

        if (from.HasValue) query = query.Where(w => w.Date >= from.Value);
        if (to.HasValue) query = query.Where(w => w.Date <= to.Value);

        var workouts = await query.OrderByDescending(w => w.Date).ToListAsync();
        return Ok(workouts.Select(ToSummaryDto));
    }

    // GET /api/workouts/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var workout = await _db.Workouts
            .Include(w => w.WorkoutExercises.OrderBy(we => we.Order))
            .ThenInclude(we => we.Sets.OrderBy(s => s.SetNumber))
            .Include(w => w.WorkoutExercises)
            .ThenInclude(we => we.Exercise)
            .ThenInclude(e => e.ExerciseMuscles)
            .ThenInclude(em => em.MuscleGroup)
            .FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);

        if (workout is null) return NotFound();
        return Ok(ToDetailDto(workout));
    }

    // POST /api/workouts
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertWorkoutRequest req)
    {
        var workout = BuildWorkout(Guid.NewGuid(), req);
        workout.UserId = UserId;

        _db.Workouts.Add(workout);
        await _db.SaveChangesAsync();

        return await GetDetail(workout.Id);
    }

    // PUT /api/workouts/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertWorkoutRequest req)
    {
        var workout = await _db.Workouts
            .Include(w => w.WorkoutExercises)
            .ThenInclude(we => we.Sets)
            .FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);

        if (workout is null) return NotFound();

        workout.Date = req.Date;
        workout.Name = req.Name;
        workout.Notes = req.Notes;
        workout.DurationMinutes = req.DurationMinutes;

        // Replace exercises + sets
        workout.WorkoutExercises.Clear();
        foreach (var (we, i) in req.Exercises.Select((x, i) => (x, i)))
        {
            var weEntity = new WorkoutExercise
            {
                Id = Guid.NewGuid(),
                WorkoutId = id,
                ExerciseId = we.ExerciseId,
                Order = we.Order,
            };
            foreach (var s in we.Sets)
            {
                weEntity.Sets.Add(new WorkoutSet
                {
                    Id = Guid.NewGuid(),
                    SetNumber = s.SetNumber,
                    Reps = s.Reps,
                    WeightKg = s.WeightKg,
                    Rpe = s.Rpe,
                });
            }
            workout.WorkoutExercises.Add(weEntity);
        }

        await _db.SaveChangesAsync();
        return await GetDetail(id);
    }

    // DELETE /api/workouts/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var workout = await _db.Workouts.FirstOrDefaultAsync(w => w.Id == id && w.UserId == UserId);
        if (workout is null) return NotFound();
        _db.Workouts.Remove(workout);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/workouts/import
    [HttpPost("import")]
    public async Task<IActionResult> ImportFromText([FromBody] ImportWorkoutRequest req)
    {
        var parsed = HevyParser.Parse(req.Text);
        if (parsed is null) return BadRequest("Workout-Text konnte nicht geparst werden.");

        var allExercises = await _db.Exercises
            .Where(e => e.UserId == null || e.UserId == UserId)
            .ToListAsync();

        var workout = new Workout
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Date = parsed.Date,
            Name = parsed.Name,
        };

        int order = 0;
        foreach (var pe in parsed.Exercises)
        {
            var exercise = allExercises.FirstOrDefault(e =>
                string.Equals(e.Name, pe.Name, StringComparison.OrdinalIgnoreCase));

            if (exercise is null)
            {
                exercise = new Exercise
                {
                    Id = Guid.NewGuid(),
                    UserId = UserId,
                    Name = pe.Name,
                    IsCustom = true,
                };
                _db.Exercises.Add(exercise);
                allExercises.Add(exercise);
            }

            var we = new WorkoutExercise
            {
                Id = Guid.NewGuid(),
                WorkoutId = workout.Id,
                ExerciseId = exercise.Id,
                Order = order++,
            };

            foreach (var ps in pe.Sets)
            {
                we.Sets.Add(new WorkoutSet
                {
                    Id = Guid.NewGuid(),
                    SetNumber = ps.SetNumber,
                    WeightKg = ps.WeightKg,
                    Reps = ps.Reps,
                });
            }

            workout.WorkoutExercises.Add(we);
        }

        _db.Workouts.Add(workout);
        await _db.SaveChangesAsync();

        return await GetDetail(workout.Id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<IActionResult> GetDetail(Guid id)
    {
        var workout = await _db.Workouts
            .Include(w => w.WorkoutExercises.OrderBy(we => we.Order))
            .ThenInclude(we => we.Sets.OrderBy(s => s.SetNumber))
            .Include(w => w.WorkoutExercises)
            .ThenInclude(we => we.Exercise)
            .ThenInclude(e => e.ExerciseMuscles)
            .ThenInclude(em => em.MuscleGroup)
            .FirstAsync(w => w.Id == id);

        return Ok(ToDetailDto(workout));
    }

    private static Workout BuildWorkout(Guid id, UpsertWorkoutRequest req)
    {
        var workout = new Workout
        {
            Id = id,
            Date = req.Date,
            Name = req.Name,
            Notes = req.Notes,
            DurationMinutes = req.DurationMinutes,
        };

        foreach (var we in req.Exercises)
        {
            var weEntity = new WorkoutExercise
            {
                Id = Guid.NewGuid(),
                WorkoutId = id,
                ExerciseId = we.ExerciseId,
                Order = we.Order,
            };
            foreach (var s in we.Sets)
            {
                weEntity.Sets.Add(new WorkoutSet
                {
                    Id = Guid.NewGuid(),
                    SetNumber = s.SetNumber,
                    Reps = s.Reps,
                    WeightKg = s.WeightKg,
                    Rpe = s.Rpe,
                });
            }
            workout.WorkoutExercises.Add(weEntity);
        }

        return workout;
    }

    private static WorkoutSummaryDto ToSummaryDto(Workout w) => new(
        w.Id,
        w.Date,
        w.Name,
        w.DurationMinutes,
        w.WorkoutExercises.Count,
        w.WorkoutExercises.Sum(we => we.Sets.Count)
    );

    private static WorkoutDetailDto ToDetailDto(Workout w) => new(
        w.Id,
        w.Date,
        w.Name,
        w.Notes,
        w.DurationMinutes,
        w.CreatedAt,
        w.WorkoutExercises.OrderBy(we => we.Order).Select(we => new WorkoutExerciseDto(
            we.Id,
            we.ExerciseId,
            we.Exercise.Name,
            we.Exercise.ExerciseMuscles.Select(em =>
                new MuscleGroupRef(em.MuscleGroupId, em.MuscleGroup.Name, em.MuscleGroup.Slug, em.IsPrimary)
            ).ToList(),
            we.Order,
            we.Sets.OrderBy(s => s.SetNumber).Select(s =>
                new SetDto(s.Id, s.SetNumber, s.Reps, s.WeightKg, s.Rpe)
            ).ToList()
        )).ToList()
    );
}

// ── DTOs ──────────────────────────────────────────────────────────────────

public record WorkoutSummaryDto(
    Guid Id,
    DateOnly Date,
    string? Name,
    int? DurationMinutes,
    int ExerciseCount,
    int SetCount
);

public record WorkoutDetailDto(
    Guid Id,
    DateOnly Date,
    string? Name,
    string? Notes,
    int? DurationMinutes,
    DateTimeOffset CreatedAt,
    List<WorkoutExerciseDto> Exercises
);

public record WorkoutExerciseDto(
    Guid Id,
    Guid ExerciseId,
    string ExerciseName,
    List<MuscleGroupRef> Muscles,
    int Order,
    List<SetDto> Sets
);

public record SetDto(Guid Id, int SetNumber, int? Reps, decimal? WeightKg, decimal? Rpe);

public record UpsertWorkoutRequest(
    DateOnly Date,
    string? Name,
    string? Notes,
    int? DurationMinutes,
    List<UpsertWorkoutExerciseRequest> Exercises
);

public record UpsertWorkoutExerciseRequest(Guid ExerciseId, int Order, List<UpsertSetRequest> Sets);

public record UpsertSetRequest(int SetNumber, int? Reps, decimal? WeightKg, decimal? Rpe);

public record ImportWorkoutRequest(string Text);

// ── Hevy text parser ──────────────────────────────────────────────────────

file record ParsedWorkout(string? Name, DateOnly Date, List<ParsedExercise> Exercises);
file record ParsedExercise(string Name) { public List<ParsedSet> Sets { get; } = []; }
file record ParsedSet(int SetNumber, int Reps, decimal WeightKg);

file static class HevyParser
{
    private static readonly Regex SetLine = new(
        @"^Set\s+(\d+):\s*(\d+(?:[.,]\d+)?)\s*kg\s*x\s*(\d+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Dictionary<string, int> MonthMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Jan"] = 1, ["Feb"] = 2, ["Mar"] = 3, ["Mär"] = 3, ["Apr"] = 4,
        ["May"] = 5, ["Mai"] = 5, ["Jun"] = 6, ["Jul"] = 7, ["Aug"] = 8,
        ["Sep"] = 9, ["Oct"] = 10, ["Okt"] = 10, ["Nov"] = 11, ["Dec"] = 12, ["Dez"] = 12,
    };

    public static ParsedWorkout? Parse(string text)
    {
        var lines = text.Split('\n').Select(l => l.Trim()).ToList();
        int i = 0;

        while (i < lines.Count && string.IsNullOrEmpty(lines[i])) i++;
        if (i >= lines.Count) return null;

        var name = lines[i++];

        while (i < lines.Count && string.IsNullOrEmpty(lines[i])) i++;
        DateOnly date = DateOnly.FromDateTime(DateTime.Today);
        if (i < lines.Count)
        {
            date = ParseDate(lines[i]) ?? date;
            i++;
        }

        var exercises = new List<ParsedExercise>();
        ParsedExercise? current = null;

        while (i < lines.Count)
        {
            var line = lines[i++];
            if (string.IsNullOrEmpty(line)) continue;
            if (line.StartsWith('@') || line.StartsWith("http", StringComparison.OrdinalIgnoreCase)) break;

            var m = SetLine.Match(line);
            if (m.Success && current is not null)
            {
                var setNum = int.Parse(m.Groups[1].Value);
                var weight = decimal.Parse(m.Groups[2].Value.Replace(',', '.'), System.Globalization.CultureInfo.InvariantCulture);
                var reps = int.Parse(m.Groups[3].Value);
                current.Sets.Add(new ParsedSet(setNum, reps, weight));
            }
            else if (!m.Success)
            {
                if (current?.Sets.Count > 0) exercises.Add(current);
                current = new ParsedExercise(line);
            }
        }

        if (current?.Sets.Count > 0) exercises.Add(current);
        if (exercises.Count == 0) return null;

        return new ParsedWorkout(name, date, exercises);
    }

    private static DateOnly? ParseDate(string line)
    {
        var m = Regex.Match(line, @"(\w{3})\s+(\d{1,2}),\s*(\d{4})");
        if (!m.Success) return null;
        if (!MonthMap.TryGetValue(m.Groups[1].Value, out var month)) return null;
        return new DateOnly(int.Parse(m.Groups[3].Value), month, int.Parse(m.Groups[2].Value));
    }
}
