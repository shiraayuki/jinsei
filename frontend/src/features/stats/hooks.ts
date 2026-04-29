import { useQuery } from '@tanstack/react-query'
import { statsApi } from './api'

export function useWorkoutVolume(weeks = 12) {
  return useQuery({
    queryKey: ['stats', 'volume', weeks],
    queryFn: () => statsApi.workoutVolume(weeks),
  })
}

export function useWorkoutFrequency(weeks = 12) {
  return useQuery({
    queryKey: ['stats', 'frequency', weeks],
    queryFn: () => statsApi.workoutFrequency(weeks),
  })
}

export function usePersonalRecords() {
  return useQuery({
    queryKey: ['stats', 'prs'],
    queryFn: () => statsApi.prs(),
  })
}

export function useExerciseProgression(exerciseId: string | null, days = 90) {
  return useQuery({
    queryKey: ['stats', 'progression', exerciseId, days],
    queryFn: () => statsApi.exerciseProgression(exerciseId!, days),
    enabled: !!exerciseId,
  })
}
