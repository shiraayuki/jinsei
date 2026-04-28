using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Habit> Habits => Set<Habit>();
    public DbSet<HabitSchedule> HabitSchedules => Set<HabitSchedule>();
    public DbSet<HabitEntry> HabitEntries => Set<HabitEntry>();
    public DbSet<MuscleGroup> MuscleGroups => Set<MuscleGroup>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<ExerciseMuscle> ExerciseMuscles => Set<ExerciseMuscle>();
    public DbSet<Workout> Workouts => Set<Workout>();
    public DbSet<WorkoutExercise> WorkoutExercises => Set<WorkoutExercise>();
    public DbSet<WorkoutSet> WorkoutSets => Set<WorkoutSet>();
    public DbSet<FoodItem> FoodItems => Set<FoodItem>();
    public DbSet<MealEntry> MealEntries => Set<MealEntry>();
    public DbSet<WeightEntry> WeightEntries => Set<WeightEntry>();
    public DbSet<SleepEntry> SleepEntries => Set<SleepEntry>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<HabitSchedule>(e =>
        {
            e.HasKey(x => x.HabitId);
            e.Property(x => x.DaysOfWeek).HasColumnType("jsonb");
            e.Property(x => x.ScheduleType).HasConversion<string>();
        });

        builder.Entity<ExerciseMuscle>(e =>
        {
            e.HasKey(x => new { x.ExerciseId, x.MuscleGroupId });
        });

        builder.Entity<MuscleGroup>().HasData(
            new MuscleGroup { Id = 1, Name = "Brust", Slug = "chest" },
            new MuscleGroup { Id = 2, Name = "Rücken", Slug = "back" },
            new MuscleGroup { Id = 3, Name = "Schultern", Slug = "shoulders" },
            new MuscleGroup { Id = 4, Name = "Bizeps", Slug = "biceps" },
            new MuscleGroup { Id = 5, Name = "Trizeps", Slug = "triceps" },
            new MuscleGroup { Id = 6, Name = "Quadrizeps", Slug = "quadriceps" },
            new MuscleGroup { Id = 7, Name = "Hamstrings", Slug = "hamstrings" },
            new MuscleGroup { Id = 8, Name = "Glutes", Slug = "glutes" },
            new MuscleGroup { Id = 9, Name = "Waden", Slug = "calves" },
            new MuscleGroup { Id = 10, Name = "Bauch", Slug = "abs" },
            new MuscleGroup { Id = 11, Name = "Unterarme", Slug = "forearms" }
        );
    }
}
