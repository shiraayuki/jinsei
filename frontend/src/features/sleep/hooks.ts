import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sleepApi } from './api'

const KEY = 'sleep'

export function useSleep(days = 30) {
  return useQuery({ queryKey: [KEY, days], queryFn: () => sleepApi.list(days) })
}

export function useUpsertSleep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      date: string
      bedTime: string
      wakeTime: string
      quality: number
      notes?: string
    }) => sleepApi.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteSleep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sleepApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
