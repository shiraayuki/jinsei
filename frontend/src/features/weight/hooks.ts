import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weightApi } from './api'

const KEY = 'weight'

export function useWeight(days = 90) {
  return useQuery({ queryKey: [KEY, days], queryFn: () => weightApi.list(days) })
}

export function useUpsertWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { date: string; weightKg: number; notes?: string }) =>
      weightApi.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useDeleteWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => weightApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
