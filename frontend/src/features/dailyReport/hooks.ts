import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dailyReportApi } from './api'

const KEY = 'dailyReport'

export function useDailyReport(date: string) {
  return useQuery({ queryKey: [KEY, date], queryFn: () => dailyReportApi.get(date) })
}

export function useGenerateDailyReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => dailyReportApi.generate(date),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
