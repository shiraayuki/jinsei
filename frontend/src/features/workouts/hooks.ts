import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workoutsApi } from './api'

const KEY = 'workouts'

export function useWorkouts(days = 90) {
  return useQuery({ queryKey: [KEY, 'list', days], queryFn: () => workoutsApi.list(days) })
}

export function useWorkout(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => workoutsApi.get(id!),
    enabled: !!id,
  })
}

export function useWorkoutAnalytics(days = 90) {
  return useQuery({ queryKey: [KEY, 'analytics', days], queryFn: () => workoutsApi.analytics(days) })
}

export function useSyncStatus() {
  return useQuery({ queryKey: [KEY, 'syncStatus'], queryFn: () => workoutsApi.syncStatus() })
}

export function useSyncWorkouts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => workoutsApi.sync(),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workoutsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
