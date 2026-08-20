import { api } from '../../lib/api'

export interface ActivityEntry {
  id: string | null
  date: string
  steps: number | null
  /** null means nothing has been said about cardio for that day yet. */
  cardio: boolean | null
  cardioMinutes: number | null
}

export type ActivityInput = Omit<ActivityEntry, 'id'>

export const activityApi = {
  list: (days = 30) => api.get<ActivityEntry[]>(`/activity?days=${days}`),
  get: (date: string) => api.get<ActivityEntry>(`/activity/${date}`),
  upsert: (data: ActivityInput) => api.post('/activity', data),
}
