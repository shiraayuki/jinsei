/**
 * Calendar date as YYYY-MM-DD in the device's own timezone.
 *
 * toISOString converts to UTC first, so east of Greenwich it reports the
 * previous day for any local time before the offset — which silently shifted
 * every date this app handles.
 */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Today, in the device's timezone. */
export function todayIso(): string {
  return toIsoDate(new Date())
}

/** The same calendar date shifted by whole days. */
export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}
