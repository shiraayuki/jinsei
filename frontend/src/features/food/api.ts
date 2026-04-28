import { api } from '../../lib/api'

export interface FoodItem {
  id: string | null
  source: string
  externalId: string | null
  name: string
  brand?: string
  kcalPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g?: number
  servingSizeG?: number
}

export interface MealEntry {
  id: string
  date: string
  mealType: string
  grams: number
  foodItem: FoodItem
  kcal: number
  protein: number
  loggedAt: string
}

export interface MacroSummary {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export const foodApi = {
  search: (q: string) => api.get<FoodItem[]>(`/food/search?q=${encodeURIComponent(q)}`),
  byBarcode: (code: string) => api.get<FoodItem>(`/food/barcode/${code}`),
  saveItem: (item: Omit<FoodItem, 'id'>) => api.post<FoodItem>('/food/items', item),
  getMeals: (date: string) => api.get<MealEntry[]>(`/meals?date=${date}`),
  getSummary: (date: string) => api.get<MacroSummary>(`/meals/summary?date=${date}`),
  logMeal: (data: { date: string; mealType: string; foodItemId: string; grams: number }) =>
    api.post<MealEntry>('/meals', data),
  updateMeal: (
    id: string,
    data: { date: string; mealType: string; foodItemId: string; grams: number },
  ) => api.put<MealEntry>(`/meals/${id}`, data),
  deleteMeal: (id: string) => api.delete(`/meals/${id}`),
}
