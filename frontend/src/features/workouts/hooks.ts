import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { exercisesApi, workoutsApi, type UpsertWorkoutPayload } from './api'

export function useMuscleGroups() {
  return useQuery({ queryKey: ['muscle-groups'], queryFn: exercisesApi.muscleGroups, staleTime: Infinity })
}

export function useExercises(q?: string, muscle?: string) {
  return useQuery({
    queryKey: ['exercises', q, muscle],
    queryFn: () => exercisesApi.list(q, muscle),
  })
}

export function useCreateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: exercisesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => exercisesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  })
}

export function useWorkouts(from?: string, to?: string) {
  return useQuery({
    queryKey: ['workouts', from, to],
    queryFn: () => workoutsApi.list(from, to),
  })
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: ['workouts', id],
    queryFn: () => workoutsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpsertWorkoutPayload) => workoutsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

export function useUpdateWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpsertWorkoutPayload }) =>
      workoutsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['workouts'] })
      qc.invalidateQueries({ queryKey: ['workouts', id] })
    },
  })
}

export function useDeleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workoutsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workouts'] }),
  })
}
