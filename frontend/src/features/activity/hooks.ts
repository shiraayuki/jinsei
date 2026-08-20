import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { activityApi, type ActivityInput } from './api'

const KEY = 'activity'

export function useActivity(days = 30) {
  return useQuery({ queryKey: [KEY, 'list', days], queryFn: () => activityApi.list(days) })
}

export function useActivityDay(date: string) {
  return useQuery({ queryKey: [KEY, 'day', date], queryFn: () => activityApi.get(date) })
}

export function useUpsertActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ActivityInput) => activityApi.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
