import { api } from '../../lib/api'

export interface DailyReport {
  id: string | null
  date: string
  content: string | null
  generatedAt: string | null
  source: 'manual' | 'scheduled' | null
}

export const dailyReportApi = {
  get: (date: string) => api.get<DailyReport>(`/reports/daily/${date}`),
  generate: (date: string) =>
    api.post<DailyReport>('/reports/daily/generate', { date }, { queueOffline: false }),
}
