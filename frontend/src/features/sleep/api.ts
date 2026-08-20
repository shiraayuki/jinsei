import { api } from '../../lib/api'

export interface SleepEntry {
  id: string
  date: string
  timeInBedMinutes: number | null
  actualSleepMinutes: number | null
  quality: number | null
  /** Share of the time in bed actually spent asleep, in percent. */
  efficiency: number | null
  notes?: string
  loggedAt: string
}

export interface SleepInput {
  date: string
  timeInBedMinutes: number | null
  actualSleepMinutes: number | null
  quality: number | null
  notes?: string
}

export const sleepApi = {
  list: (days = 30) => api.get<SleepEntry[]>(`/sleep?days=${days}`),
  upsert: (data: SleepInput) => api.post('/sleep', data),
  delete: (id: string) => api.delete(`/sleep/${id}`),
}
