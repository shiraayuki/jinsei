import { api } from '../../lib/api'

export interface WeightEntry {
  id: string
  date: string
  weightKg: number
  notes?: string
  loggedAt: string
}

export const weightApi = {
  list: (days = 90) => api.get<WeightEntry[]>(`/weight?days=${days}`),
  upsert: (data: { date: string; weightKg: number; notes?: string }) =>
    api.post('/weight', data),
  delete: (id: string) => api.delete(`/weight/${id}`),
}
