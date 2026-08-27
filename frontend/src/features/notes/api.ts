import { api } from '../../lib/api'

export interface DayNote {
  id: string | null
  date: string
  text: string | null
}

export const notesApi = {
  get: (date: string) => api.get<DayNote>(`/notes/${date}`),
  upsert: (data: { date: string; text: string | null }) => api.post('/notes', data),
}
