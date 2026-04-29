import { api } from '../../lib/api'

// exercisesApi extended with last-performance

export interface MuscleGroupRef {
  id: number
  name: string
  slug: string
  isPrimary: boolean
}

export interface MuscleGroup {
  id: number
  name: string
  slug: string
}

export interface Exercise {
  id: string
  name: string
  description?: string
  equipment?: string
  isCustom: boolean
  muscles: MuscleGroupRef[]
}

export interface WorkoutSet {
  id: string
  setNumber: number
  reps?: number
  weightKg?: number
  rpe?: number
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  exerciseName: string
  muscles: MuscleGroupRef[]
  order: number
  sets: WorkoutSet[]
}

export interface WorkoutSummary {
  id: string
  date: string
  name?: string
  durationMinutes?: number
  exerciseCount: number
  setCount: number
}

export interface WorkoutDetail extends WorkoutSummary {
  notes?: string
  createdAt: string
  exercises: WorkoutExercise[]
}

export interface UpsertWorkoutPayload {
  date: string
  name?: string
  notes?: string
  durationMinutes?: number
  exercises: {
    exerciseId: string
    order: number
    sets: {
      setNumber: number
      reps?: number
      weightKg?: number
      rpe?: number
    }[]
  }[]
}

export const exercisesApi = {
  list: (q?: string, muscle?: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (muscle) params.set('muscle', muscle)
    return api.get<Exercise[]>(`/exercises?${params}`)
  },
  create: (data: { name: string; description?: string; equipment?: string; muscles: { muscleGroupId: number; isPrimary: boolean }[] }) =>
    api.post<Exercise>('/exercises', data),
  update: (id: string, data: { name: string; description?: string; equipment?: string; muscles: { muscleGroupId: number; isPrimary: boolean }[] }) =>
    api.put<Exercise>(`/exercises/${id}`, data),
  delete: (id: string) => api.delete(`/exercises/${id}`),
  muscleGroups: () => api.get<MuscleGroup[]>('/muscle-groups'),
  lastPerformance: (id: string) => api.get<LastPerformance | null>(`/exercises/${id}/last-performance`),
}

export interface LastSet {
  setNumber: number
  reps?: number
  weightKg?: number
}

export interface LastPerformance {
  date: string
  sets: LastSet[]
}

export interface RoutineExercise {
  id: string
  exerciseId: string
  exerciseName: string
  muscles: MuscleGroupRef[]
  setCount: number
  order: number
}

export interface Routine {
  id: string
  name: string
  createdAt: string
  exercises: RoutineExercise[]
}

export interface UpsertRoutinePayload {
  name: string
  exercises: { exerciseId: string; setCount: number }[]
}

export const routinesApi = {
  list: () => api.get<Routine[]>('/routines'),
  create: (data: UpsertRoutinePayload) => api.post<Routine>('/routines', data),
  update: (id: string, data: UpsertRoutinePayload) => api.put<Routine>(`/routines/${id}`, data),
  delete: (id: string) => api.delete(`/routines/${id}`),
}

export const workoutsApi = {
  list: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return api.get<WorkoutSummary[]>(`/workouts?${params}`)
  },
  get: (id: string) => api.get<WorkoutDetail>(`/workouts/${id}`),
  create: (data: UpsertWorkoutPayload) => api.post<WorkoutDetail>('/workouts', data),
  update: (id: string, data: UpsertWorkoutPayload) => api.put<WorkoutDetail>(`/workouts/${id}`, data),
  delete: (id: string) => api.delete(`/workouts/${id}`),
}
