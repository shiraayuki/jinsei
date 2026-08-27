using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Habit> Habits => Set<Habit>();
    public DbSet<HabitSchedule> HabitSchedules => Set<HabitSchedule>();
    public DbSet<HabitEntry> HabitEntries => Set<HabitEntry>();
    public DbSet<WeightEntry> WeightEntries => Set<WeightEntry>();
    public DbSet<SleepEntry> SleepEntries => Set<SleepEntry>();
    public DbSet<NutritionEntry> NutritionEntries => Set<NutritionEntry>();
    public DbSet<ActivityEntry> ActivityEntries => Set<ActivityEntry>();
    public DbSet<WorkoutLog> WorkoutLogs => Set<WorkoutLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<HabitSchedule>(e =>
        {
            e.HasKey(x => x.HabitId);
            e.Property(x => x.DaysOfWeek).HasColumnType("jsonb");
            e.Property(x => x.ScheduleType).HasConversion<string>();
        });

        // One entry per day for the metrics that are kept as daily totals.
        builder.Entity<SleepEntry>()
            .HasIndex(x => new { x.UserId, x.Date })
            .IsUnique();

        builder.Entity<NutritionEntry>()
            .HasIndex(x => new { x.UserId, x.Date })
            .IsUnique();

        builder.Entity<ActivityEntry>()
            .HasIndex(x => new { x.UserId, x.Date })
            .IsUnique();

        builder.Entity<WeightEntry>()
            .HasIndex(x => new { x.UserId, x.Date })
            .IsUnique();

        // A workout is identified by the provider's id, which makes a re-sync
        // an update rather than a duplicate.
        builder.Entity<WorkoutLog>()
            .HasIndex(x => new { x.UserId, x.Source, x.ExternalId })
            .IsUnique();
    }
}
