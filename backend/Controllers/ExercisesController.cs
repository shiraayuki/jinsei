using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api")]
[Authorize]
public class ExercisesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public ExercisesController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    // GET /api/muscle-groups
    [HttpGet("muscle-groups")]
    public async Task<IActionResult> GetMuscleGroups()
    {
        var groups = await _db.MuscleGroups.OrderBy(m => m.Name).ToListAsync();
        return Ok(groups.Select(m => new MuscleGroupDto(m.Id, m.Name, m.Slug)));
    }

    // GET /api/exercises?q=&muscle=
    [HttpGet("exercises")]
    public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] string? muscle)
    {
        var query = _db.Exercises
            .Include(e => e.ExerciseMuscles)
            .ThenInclude(em => em.MuscleGroup)
            .Where(e => e.UserId == null || e.UserId == UserId);

        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(e => e.Name.ToLower().Contains(q.ToLower()));

        if (!string.IsNullOrWhiteSpace(muscle))
            query = query.Where(e => e.ExerciseMuscles.Any(em => em.MuscleGroup.Slug == muscle));

        var exercises = await query.OrderBy(e => e.Name).ToListAsync();
        var ids = exercises.Select(e => e.Id).ToList();
        var prefs = await _db.ExerciseRestPreferences
            .Where(p => p.UserId == UserId && ids.Contains(p.ExerciseId))
            .ToDictionaryAsync(p => p.ExerciseId, p => p.RestSeconds);

        return Ok(exercises.Select(e => ToDto(e, prefs.GetValueOrDefault(e.Id))));
    }

    // POST /api/exercises
    [HttpPost("exercises")]
    public async Task<IActionResult> Create([FromBody] UpsertExerciseRequest req)
    {
        var exercise = new Exercise
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Name = req.Name,
            Description = req.Description,
            Equipment = req.Equipment,
            IsCustom = true,
        };

        foreach (var m in req.Muscles)
        {
            exercise.ExerciseMuscles.Add(new ExerciseMuscle
            {
                ExerciseId = exercise.Id,
                MuscleGroupId = m.MuscleGroupId,
                IsPrimary = m.IsPrimary,
            });
        }

        _db.Exercises.Add(exercise);
        await _db.SaveChangesAsync();

        var loaded = await _db.Exercises
            .Include(e => e.ExerciseMuscles).ThenInclude(em => em.MuscleGroup)
            .FirstAsync(e => e.Id == exercise.Id);

        return CreatedAtAction(nameof(List), ToDto(loaded));
    }

    // PUT /api/exercises/{id}
    [HttpPut("exercises/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertExerciseRequest req)
    {
        var exercise = await _db.Exercises
            .Include(e => e.ExerciseMuscles)
            .FirstOrDefaultAsync(e => e.Id == id && e.UserId == UserId);

        if (exercise is null) return NotFound();

        exercise.Name = req.Name;
        exercise.Description = req.Description;
        exercise.Equipment = req.Equipment;

        exercise.ExerciseMuscles.Clear();
        foreach (var m in req.Muscles)
        {
            exercise.ExerciseMuscles.Add(new ExerciseMuscle
            {
                ExerciseId = id,
                MuscleGroupId = m.MuscleGroupId,
                IsPrimary = m.IsPrimary,
            });
        }

        await _db.SaveChangesAsync();

        var loaded = await _db.Exercises
            .Include(e => e.ExerciseMuscles).ThenInclude(em => em.MuscleGroup)
            .FirstAsync(e => e.Id == id);

        return Ok(ToDto(loaded));
    }

    // GET /api/exercises/{id}/last-performance
    [HttpGet("exercises/{id:guid}/last-performance")]
    public async Task<IActionResult> LastPerformance(Guid id)
    {
        var lastWorkoutExercise = await _db.WorkoutExercises
            .Include(we => we.Sets.OrderBy(s => s.SetNumber))
            .Include(we => we.Workout)
            .Where(we => we.ExerciseId == id && we.Workout.UserId == UserId)
            .OrderByDescending(we => we.Workout.Date)
            .ThenByDescending(we => we.Workout.CreatedAt)
            .FirstOrDefaultAsync();

        if (lastWorkoutExercise is null) return Ok(null);

        return Ok(new LastPerformanceDto(
            lastWorkoutExercise.Workout.Date,
            lastWorkoutExercise.Sets.Select(s => new LastSetDto(s.SetNumber, s.Reps, s.WeightKg)).ToList()
        ));
    }

    // PUT /api/exercises/{id}/rest-seconds
    [HttpPut("exercises/{id:guid}/rest-seconds")]
    public async Task<IActionResult> SetRestSeconds(Guid id, [FromBody] SetRestSecondsRequest req)
    {
        var existing = await _db.ExerciseRestPreferences
            .FirstOrDefaultAsync(p => p.UserId == UserId && p.ExerciseId == id);

        if (existing is null)
        {
            _db.ExerciseRestPreferences.Add(new ExerciseRestPreference
            {
                UserId = UserId,
                ExerciseId = id,
                RestSeconds = req.RestSeconds,
            });
        }
        else
        {
            existing.RestSeconds = req.RestSeconds;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE /api/exercises/{id}
    [HttpDelete("exercises/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var exercise = await _db.Exercises
            .FirstOrDefaultAsync(e => e.Id == id && e.UserId == UserId);

        if (exercise is null) return NotFound();
        _db.Exercises.Remove(exercise);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static ExerciseDto ToDto(Exercise e, int? restSeconds = null) => new(
        e.Id,
        e.Name,
        e.Description,
        e.Equipment,
        e.IsCustom,
        restSeconds,
        e.ExerciseMuscles.Select(em => new MuscleGroupRef(
            em.MuscleGroupId, em.MuscleGroup.Name, em.MuscleGroup.Slug, em.IsPrimary
        )).ToList()
    );
}

public record MuscleGroupDto(int Id, string Name, string Slug);
public record MuscleGroupRef(int Id, string Name, string Slug, bool IsPrimary);
public record ExerciseDto(Guid Id, string Name, string? Description, string? Equipment, bool IsCustom, int? RestSeconds, List<MuscleGroupRef> Muscles);
public record UpsertExerciseRequest(string Name, string? Description, string? Equipment, List<ExerciseMuscleRef> Muscles);
public record SetRestSecondsRequest(int RestSeconds);
public record ExerciseMuscleRef(int MuscleGroupId, bool IsPrimary);
public record LastPerformanceDto(DateOnly Date, List<LastSetDto> Sets);
public record LastSetDto(int SetNumber, int? Reps, decimal? WeightKg);
