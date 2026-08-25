import { dateLocale } from '../../i18n'
import { byWeek, densify, type Point } from '../../lib/stats'
import { todayIso, shiftIso } from '../../lib/date'

export function num(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return '–'
  return value.toLocaleString(dateLocale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export function duration(minutes: number | null | undefined): string {
  if (minutes == null) return '–'
  const sign = minutes < 0 ? '−' : ''
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = Math.round(abs % 60)
  return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`
}

/**
 * Turns dated rows into a gap-filled daily series covering the whole range.
 *
 * Charts space their points evenly, so a series holding only the logged days
 * would draw a fortnight's gap at the same width as a single missed day.
 */
export function series<T extends { date: string }>(
  rows: T[],
  pick: (row: T) => number | null,
  days: number,
): Point[] {
  const to = todayIso()
  const from = shiftIso(to, -(days - 1))
  return densify(
    rows.map(r => ({ date: r.date, value: pick(r) })),
    from,
    to,
  )
}

/** Splits a series into the current window and the one before it, for deltas. */
export function splitWindow(points: Point[], windowDays: number) {
  const current = points.slice(-windowDays)
  const previous = points.slice(-windowDays * 2, -windowDays)
  return { current, previous }
}

/**
 * Rolls a daily series up into weeks once the bars would be thinner than they
 * are tall. Ninety hairlines on a phone are a texture, not a chart; thirteen
 * weekly bars are the same information at a width that can be tapped.
 */
export function perWeekIfDense(points: Point[], how: 'sum' | 'mean' = 'mean'): { points: Point[]; weekly: boolean } {
  if (points.length <= 45) return { points, weekly: false }
  return { points: byWeek(points, how).map(b => ({ date: b.date, value: b.value })), weekly: true }
}
