import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesApi } from './api'

const KEY = 'notes'

export function useDayNote(date: string) {
  return useQuery({ queryKey: [KEY, date], queryFn: () => notesApi.get(date) })
}

export function useUpsertDayNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { date: string; text: string | null }) => notesApi.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
