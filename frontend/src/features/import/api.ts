import { api } from '../../lib/api'

/**
 * Sleep only. The nutrition screenshot path was dropped from the form — the
 * numbers are four fields that are quicker typed than photographed — and the
 * backend still understands the kind, so bringing it back is a UI change.
 */
export type ImportKind = 'sleep'

export interface SleepDraftFields {
  timeInBedMinutes: number | null
  actualSleepMinutes: number | null
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
