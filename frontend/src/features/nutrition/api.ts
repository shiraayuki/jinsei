import { api } from '../../lib/api'

export interface NutritionEntry {
  id: string | null
  date: string
  kcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fiberG: number | null
  waterL: number | null
  coffeeMl: number | null
  /** "HH:mm" of the last coffee of the day. */
  lastCoffee: string | null
  notes?: string | null
}

export type NutritionInput = Omit<NutritionEntry, 'id'>

export const nutritionApi = {
  list: (days = 30) => api.get<NutritionEntry[]>(`/nutrition?days=${days}`),
  get: (date: string) => api.get<NutritionEntry>(`/nutrition/${date}`),
  upsert: (data: NutritionInput) => api.post('/nutrition', data),
}
