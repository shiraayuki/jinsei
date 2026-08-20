import { api } from '../../lib/api'

export interface WeightEntry {
  id: string
  date: string
  /** Either measurement can stand on its own, so both are optional. */
  weightKg: number | null
  waistCm: number | null
  notes?: string
  loggedAt: string
}

export interface WeightInput {
  date: string
  weightKg: number | null
  waistCm: number | null
  notes?: string
}

export const weightApi = {
  list: (days = 90) => api.get<WeightEntry[]>(`/weight?days=${days}`),
  upsert: (data: WeightInput) => api.post('/weight', data),
  delete: (id: string) => api.delete(`/weight/${id}`),
}
