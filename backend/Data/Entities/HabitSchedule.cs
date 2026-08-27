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

    /// <summary>
    /// Local time of day to be reminded, or null for no reminder. The reminder
    /// only goes out on a day the habit is actually due and has not already
    /// been ticked — a nudge about something already done is how a person
    /// learns to ignore the next one.
    /// </summary>
    public TimeOnly? RemindAtLocal { get; set; }
}
