import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

/** A number with the same number a week earlier, and the goal it is read against. */
export interface Change {
  now: number | null
  before: number | null
  goal: number | null
}

/**
 * The week against the week before it.
 *
 * Every figure carries its predecessor rather than a verdict: the review says
 * what moved and in which direction, and stops there. Nothing here is prose,
 * and nothing is praise.
 */
export interface WeekReview {
  weekStart: string
  weekEnd: string
  sessions: Change
  sets: Change
  volumeKg: Change
  sleepMinutes: Change
  sleepNights: number
  kcal: Change
  kcalDays: number
  kcalOnTargetDays: number
  proteinG: Change
  steps: Change
  trendWeightKg: Change
  ratePerWeekKg: number | null
  kcalGoal: number | null
  /** Whether the Monday job (or the button) rewrote the goal during this week. */
  kcalGoalSetThisWeek: boolean
}

export function useWeekReview(date: string) {
  return useQuery({
    queryKey: ['week-review', date],
    queryFn: () => api.get<WeekReview>(`/summary/week/${date}/review`),
  })
}
