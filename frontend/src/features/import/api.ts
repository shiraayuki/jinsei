import { api } from '../../lib/api'

export type ImportKind = 'sleep' | 'nutrition'

export interface SleepDraftFields {
  timeInBedMinutes: number | null
  actualSleepMinutes: number | null
  quality: number | null
}

export interface NutritionDraftFields {
  kcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fiberG: number | null
}

export interface ImportDraft<F> {
  kind: ImportKind
  /** The day read off the screenshot, or null when none was legible. */
  date: string | null
  fields: F
  /** Field names the model was unsure about. */
  lowConfidence: string[]
  /** Values that were dropped because they were out of range. */
  warnings: string[]
  notes: string | null
}

export interface ScreenshotRequest {
  kind: ImportKind
  /** The day being edited, used to resolve a screenshot that shows no year. */
  date: string
  imageBase64: string
  mediaType: string
}

export const importApi = {
  status: () => api.get<{ configured: boolean }>('/import/status'),
  // Never queued offline: a draft is only useful while the form that asked for
  // it is still open.
  screenshot: <F>(req: ScreenshotRequest) =>
    api.post<ImportDraft<F>>('/import/screenshot', req, { queueOffline: false }),
}
