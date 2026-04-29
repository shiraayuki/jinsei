using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/routines")]
[Authorize]
public class RoutinesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _users;

    public RoutinesController(AppDbContext db, UserManager<AppUser> users)
    {
        _db = db;
        _users = users;
    }

    private string UserId => _users.GetUserId(User)!;

    // GET /api/routines
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var routines = await _db.Routines
            .Include(r => r.Exercises.OrderBy(e => e.Order))
            .ThenInclude(re => re.Exercise)
            .ThenInclude(e => e.ExerciseMuscles)
            .ThenInclude(em => em.MuscleGroup)
            .Where(r => r.UserId == UserId)
            .OrderBy(r => r.Name)
            .ToListAsync();

        return Ok(routines.Select(ToDto));
    }

    // POST /api/routines
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertRoutineRequest req)
    {
        var routine = new Routine
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            Name = req.Name,
        };

        foreach (var (ex, i) in req.Exercises.Select((x, i) => (x, i)))
        {
            routine.Exercises.Add(new RoutineExercise
            {
                Id = Guid.NewGuid(),
                RoutineId = routine.Id,
                ExerciseId = ex.ExerciseId,
                SetCount = ex.SetCount,
                Order = i,
            });
        }

        _db.Routines.Add(routine);
        await _db.SaveChangesAsync();

        return await GetLoaded(routine.Id);
    }

    // PUT /api/routines/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertRoutineRequest req)
    {
        var routine = await _db.Routines
            .Include(r => r.Exercises)
            .FirstOrDefaultAsync(r => r.Id == id && r.UserId == UserId);

        if (routine is null) return NotFound();

        routine.Name = req.Name;
        routine.Exercises.Clear();

        foreach (var (ex, i) in req.Exercises.Select((x, i) => (x, i)))
        {
            routine.Exercises.Add(new RoutineExercise
            {
                Id = Guid.NewGuid(),
                RoutineId = id,
                ExerciseId = ex.ExerciseId,
                SetCount = ex.SetCount,
                Order = i,
            });
        }

        await _db.SaveChangesAsync();
        return await GetLoaded(id);
    }

    // DELETE /api/routines/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var routine = await _db.Routines.FirstOrDefaultAsync(r => r.Id == id && r.UserId == UserId);
        if (routine is null) return NotFound();
        _db.Routines.Remove(routine);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<IActionResult> GetLoaded(Guid id)
    {
        var r = await _db.Routines
            .Include(r => r.Exercises.OrderBy(e => e.Order))
            .ThenInclude(re => re.Exercise)
            .ThenInclude(e => e.ExerciseMuscles)
            .ThenInclude(em => em.MuscleGroup)
            .FirstAsync(r => r.Id == id);
        return Ok(ToDto(r));
    }

    private static RoutineDto ToDto(Routine r) => new(
        r.Id,
        r.Name,
        r.CreatedAt,
        r.Exercises.OrderBy(e => e.Order).Select(re => new RoutineExerciseDto(
            re.Id,
            re.ExerciseId,
            re.Exercise.Name,
            re.Exercise.ExerciseMuscles.Select(em =>
                new MuscleGroupRef(em.MuscleGroupId, em.MuscleGroup.Name, em.MuscleGroup.Slug, em.IsPrimary)
            ).ToList(),
            re.SetCount,
            re.Order
        )).ToList()
    );
}

public record RoutineDto(Guid Id, string Name, DateTimeOffset CreatedAt, List<RoutineExerciseDto> Exercises);
public record RoutineExerciseDto(Guid Id, Guid ExerciseId, string ExerciseName, List<MuscleGroupRef> Muscles, int SetCount, int Order);
public record UpsertRoutineRequest(string Name, List<UpsertRoutineExerciseRequest> Exercises);
public record UpsertRoutineExerciseRequest(Guid ExerciseId, int SetCount);
