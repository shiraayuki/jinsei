import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { wellbeingApi, type WellbeingInput } from './api'

const KEY = 'wellbeing'

export function useWellbeing(days = 30) {
  return useQuery({ queryKey: [KEY, 'list', days], queryFn: () => wellbeingApi.list(days) })
}

export function useWellbeingDay(date: string) {
  return useQuery({ queryKey: [KEY, 'day', date], queryFn: () => wellbeingApi.get(date) })
}

export function useUpsertWellbeing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WellbeingInput) => wellbeingApi.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
