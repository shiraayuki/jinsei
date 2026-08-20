import { api } from '../../lib/api'

export interface WellbeingEntry {
  id: string | null
  date: string
  /** 1–5, where 5 is the strongest. */
  hunger: number | null
  energy: number | null
  notes: string | null
}

export type WellbeingInput = Omit<WellbeingEntry, 'id'>

export const wellbeingApi = {
  list: (days = 30) => api.get<WellbeingEntry[]>(`/wellbeing?days=${days}`),
  get: (date: string) => api.get<WellbeingEntry>(`/wellbeing/${date}`),
  upsert: (data: WellbeingInput) => api.post('/wellbeing', data),
}
