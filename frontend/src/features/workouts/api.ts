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
}
