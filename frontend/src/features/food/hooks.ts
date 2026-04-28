import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { foodApi, type FoodItem } from './api'

const MEALS_KEY = 'meals'

export function useMeals(date: string) {
  return useQuery({ queryKey: [MEALS_KEY, date], queryFn: () => foodApi.getMeals(date) })
}

export function useMacroSummary(date: string) {
  return useQuery({
    queryKey: [MEALS_KEY, date, 'summary'],
    queryFn: () => foodApi.getSummary(date),
  })
}

export function useSearchFood(q: string) {
  return useQuery({
    queryKey: ['food-search', q],
    queryFn: () => foodApi.search(q),
    enabled: q.length >= 2,
    staleTime: 1000 * 60 * 5,
  })
}

export function useSaveFoodItem() {
  return useMutation({
    mutationFn: (item: Omit<FoodItem, 'id'>) => foodApi.saveItem(item),
  })
}

export function useLogMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: foodApi.logMeal,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [MEALS_KEY, vars.date] })
    },
  })
}

export function useDeleteMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; date: string }) => foodApi.deleteMeal(id),
    onSuccess: (_, { date }) => {
      qc.invalidateQueries({ queryKey: [MEALS_KEY, date] })
    },
  })
}
