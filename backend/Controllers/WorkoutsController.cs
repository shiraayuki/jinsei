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
