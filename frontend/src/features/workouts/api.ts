import { api } from '../../lib/api'

export interface WorkoutSet {
  weightKg: number | null
  reps: number | null
  durationSeconds: number | null
  distanceMeters: number | null
}

export interface WorkoutExercise {
  name: string
  sets: WorkoutSet[]
}

export interface WorkoutSummary {
  id: string
  date: string
  title: string
  durationMinutes: number | null
  exerciseCount: number
  setCount: number
  volumeKg: number
  source: string
  syncedAt: string
}

export interface WorkoutDetail extends WorkoutSummary {
  rawText: string
  exercises: WorkoutExercise[]
}

export interface SyncStatus {
  configured: boolean
  source: string
}

export interface SyncResult {
  added: number
  updated: number
  total: number
}

export const workoutsApi = {
  list: (days = 90) => api.get<WorkoutSummary[]>(`/workouts?days=${days}`),
  get: (id: string) => api.get<WorkoutDetail>(`/workouts/${id}`),
  delete: (id: string) => api.delete(`/workouts/${id}`),
  syncStatus: () => api.get<SyncStatus>('/workouts/sync/status'),
  sync: () => api.post<SyncResult>('/workouts/sync', {}),
  analytics: (days = 90) => api.get<WorkoutAnalytics>(`/workouts/analytics?days=${days}`),
}

export interface WeeklyLoad {
  weekStart: string
  sessions: number
  sets: number
  volumeKg: number
  durationMinutes: number
}

export interface MuscleGroupLoad {
  group: string
  sets: number
  setsPerWeek: number
  volumeKg: number
  /** Sets in the four weeks before the current window, for the comparison. */
  previousSets: number
  daysSince: number | null
}

export interface ExerciseSession {
  date: string
  sets: number
  volumeKg: number
  estimatedOneRepMax: number | null
  topSetWeightKg: number | null
  topSetReps: number | null
}

export interface ExerciseProgress {
  name: string
  sessions: number
  lastDate: string
  daysSince: number
  bestOneRepMax: number | null
  firstOneRepMax: number | null
  latestOneRepMax: number | null
  changePercent: number | null
  /** No new estimated max in four weeks, while the lift is still being trained. */
  stagnant: boolean
  bestDate: string | null
  history: ExerciseSession[]
}

export interface WorkoutAnalytics {
  days: number
  weekly: WeeklyLoad[]
  muscleGroups: MuscleGroupLoad[]
  exercises: ExerciseProgress[]
  totals: { sessions: number; sets: number; volumeKg: number; averageDurationMinutes: number | null }
}
