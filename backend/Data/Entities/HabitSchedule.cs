public enum ScheduleType { Daily, Weekly, Interval }

public class HabitSchedule
{
    public Guid HabitId { get; set; }
    public Habit Habit { get; set; } = null!;
    public ScheduleType ScheduleType { get; set; }
    public int TargetCount { get; set; } = 1;
    public int[]? DaysOfWeek { get; set; }
    public int? IntervalDays { get; set; }
    public DateOnly ActiveFrom { get; set; }
}
