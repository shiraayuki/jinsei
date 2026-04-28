import { api } from '../../lib/api'

export interface SleepEntry {
  id: string
  date: string
  bedTime: string
  wakeTime: string
  durationMinutes: number
  quality: number
  notes?: string
  loggedAt: string
}

export const sleepApi = {
  list: (days = 30) => api.get<SleepEntry[]>(`/sleep?days=${days}`),
  upsert: (data: {
    date: string
    bedTime: string
    wakeTime: string
    quality: number
    notes?: string
  }) => api.post('/sleep', data),
  delete: (id: string) => api.delete(`/sleep/${id}`),
}
