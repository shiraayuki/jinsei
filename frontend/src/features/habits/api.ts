import { api } from '../../lib/api'

export interface Schedule {
  type: 'daily' | 'weekly' | 'interval'
  targetCount: number
  daysOfWeek?: number[]
  intervalDays?: number
  activeFrom: string
}

export interface Habit {
  id: string
  name: string
  description?: string
  color: string
  icon?: string
  schedule: Schedule | null
  archived: boolean
  createdAt: string
  completedToday: boolean
  streak: number
}

export interface HabitEntry {
  id: string
  date: string
  completedCount: number
  notes?: string
  loggedAt: string
}

export interface UpsertHabitPayload {
  name: string
  description?: string
  color?: string
  icon?: string
  schedule: {
    type: string
    targetCount: number
    daysOfWeek?: number[]
    intervalDays?: number
    activeFrom: string
  }
}

export const habitsApi = {
  list: () => api.get<Habit[]>('/habits'),
  create: (data: UpsertHabitPayload) => api.post<Habit>('/habits', data),
  update: (id: string, data: UpsertHabitPayload) => api.put<Habit>(`/habits/${id}`, data),
  archive: (id: string) => api.delete(`/habits/${id}`),
  getEntries: (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return api.get<HabitEntry[]>(`/habits/${id}/entries?${params}`)
  },
  logEntry: (id: string, date: string, completedCount: number, notes?: string) =>
    api.post(`/habits/${id}/entries`, { date, completedCount, notes }),
  deleteEntry: (entryId: string) => api.delete(`/habits/entries/${entryId}`),
  getStats: (id: string, days = 90) => api.get<HabitStats>(`/habits/${id}/stats?days=${days}`),
}

export interface WeeklyHabitStat {
  weekStart: string
  completedCount: number
}

export interface HabitStats {
  days: number
  completedCount: number
  compliancePercent: number
  currentStreak: number
  longestStreak: number
  weekdayCounts: number[]
  completionByWeek: WeeklyHabitStat[]
}
