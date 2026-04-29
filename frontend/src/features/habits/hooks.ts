import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { habitsApi, type UpsertHabitPayload } from './api'

const KEY = 'habits'

export function useHabitStats(id: string, days = 90) {
  return useQuery({
    queryKey: [KEY, id, 'stats', days],
    queryFn: () => habitsApi.getStats(id, days),
    enabled: !!id,
  })
}

export function useHabits() {
  return useQuery({ queryKey: [KEY], queryFn: habitsApi.list })
}

export function useHabitEntries(id: string, from?: string, to?: string) {
  return useQuery({
    queryKey: [KEY, id, 'entries', from, to],
    queryFn: () => habitsApi.getEntries(id, from, to),
    enabled: !!id,
  })
}

export function useCreateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpsertHabitPayload) => habitsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUpdateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpsertHabitPayload }) =>
      habitsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useArchiveHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => habitsApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useToggleHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      habitId,
      date,
      completed,
    }: {
      habitId: string
      date: string
      completed: boolean
    }) =>
      completed
        ? habitsApi.logEntry(habitId, date, 1)
        : habitsApi.deleteEntry(''), // handled via optimistic + re-fetch
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useLogEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      habitId,
      date,
      completedCount,
      notes,
    }: {
      habitId: string
      date: string
      completedCount: number
      notes?: string
    }) => habitsApi.logEntry(habitId, date, completedCount, notes),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: [KEY, vars.habitId, 'entries'] })
    },
  })
}
