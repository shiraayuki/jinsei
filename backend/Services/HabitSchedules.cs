/// <summary>
/// Whether a habit is due on a day, by its schedule.
///
/// Its own file because two things need the answer now: the overview, which
/// asks it about every day in a range, and the reminder, which asks it about
/// today before deciding whether to interrupt anyone.
/// </summary>
public static class HabitSchedules
{
    public static bool IsScheduledOn(HabitSchedule? schedule, DateOnly day)
    {
        // A habit with no schedule at all is a daily one that was never told
        // otherwise.
        if (schedule is null) return true;
        if (day < schedule.ActiveFrom) return false;
        return schedule.ScheduleType switch
        {
            ScheduleType.Daily => true,
            ScheduleType.Weekly when schedule.DaysOfWeek is { Length: > 0 } =>
                schedule.DaysOfWeek.Contains((int)day.DayOfWeek),
            ScheduleType.Interval when schedule.IntervalDays is > 0 =>
                (day.DayNumber - schedule.ActiveFrom.DayNumber) % schedule.IntervalDays.Value == 0,
            _ => true,
        };
    }
}
