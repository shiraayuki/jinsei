import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { nutritionApi, type NutritionInput } from './api'

const KEY = 'nutrition'

export function useNutrition(days = 30) {
  return useQuery({ queryKey: [KEY, 'list', days], queryFn: () => nutritionApi.list(days) })
}

export function useNutritionDay(date: string) {
  return useQuery({ queryKey: [KEY, 'day', date], queryFn: () => nutritionApi.get(date) })
}

export function useUpsertNutrition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: NutritionInput) => nutritionApi.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
