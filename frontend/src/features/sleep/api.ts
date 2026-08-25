import { api } from '../../lib/api'

export interface SleepEntry {
  id: string
  date: string
  timeInBedMinutes: number | null
  actualSleepMinutes: number | null
  quality: number | null
  /** "HH:mm" the night started; the evening before the date, or after midnight on it. */
  bedTime: string | null
  /** "HH:mm" of getting up, on the entry's date. */
  wakeTime: string | null
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
  bedTime?: string | null
  wakeTime?: string | null
  notes?: string
}

export const sleepApi = {
  list: (days = 30) => api.get<SleepEntry[]>(`/sleep?days=${days}`),
  upsert: (data: SleepInput) => api.post('/sleep', data),
  delete: (id: string) => api.delete(`/sleep/${id}`),
}
