import { api } from '../../lib/api'

export interface WeeklyVolume {
  weekStart: string
  totalVolumeKg: number
  workoutCount: number
}

export interface WeeklyFrequency {
  weekStart: string
  workoutCount: number
  totalMinutes: number
}

export interface PR {
  exerciseId: string
  exerciseName: string
  bestWeightKg: number
  bestReps: number
  estimated1Rm: number
  achievedAt: string
}

export interface ProgressionPoint {
  date: string
  weightKg: number
  reps: number
  estimated1Rm: number
}

export const statsApi = {
  workoutVolume: (weeks = 12) =>
    api.get<WeeklyVolume[]>(`/workouts/stats/volume?weeks=${weeks}`),
  workoutFrequency: (weeks = 12) =>
    api.get<WeeklyFrequency[]>(`/workouts/stats/frequency?weeks=${weeks}`),
  prs: () =>
    api.get<PR[]>('/workouts/stats/prs'),
  exerciseProgression: (exerciseId: string, days = 90) =>
    api.get<ProgressionPoint[]>(`/workouts/stats/exercise/${exerciseId}/progression?days=${days}`),
}
