/**
 * The arithmetic behind every chart and stat on the metrics page.
 *
 * It lives outside the components because the same window average feeds a
 * sparkline, a headline number and a correlation, and three copies of it would
 * drift apart. Everything here takes and returns plain numbers with `null` for
 * "no reading", never zero — a missed day is not a day with nothing in it.
 */

export interface Point {
  date: string
  value: number | null
}

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

export function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0)
}

/** Standard deviation of a sample; null below two readings, where it means nothing. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null
  const m = mean(values)!
  return Math.sqrt(sum(values.map(v => (v - m) ** 2)) / (values.length - 1))
}

export function defined(points: Point[]): number[] {
  return points.map(p => p.value).filter((v): v is number => v != null)
}

/** Sorts any dated rows oldest first, which is the order every chart wants. */
export function asc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Centre-less trailing average over the last `window` *readings*, skipping
 * gaps rather than treating them as zero. A point stays null until there are
 * at least `minReadings` behind it, so the line does not start with an average
 * of one.
 */
export function movingAverage(points: Point[], window: number, minReadings = Math.ceil(window / 2)): Point[] {
  const seen: number[] = []
  return points.map(p => {
    if (p.value == null) return { date: p.date, value: null }
    seen.push(p.value)
    const slice = seen.slice(-window)
    return { date: p.date, value: slice.length >= minReadings ? mean(slice) : null }
  })
}

/**
 * Least-squares slope over the readings, expressed per day.
 *
 * x is the real calendar distance, not the index, so a week with three
 * weigh-ins and a week with seven produce comparable rates.
 */
export function slopePerDay(points: Point[]): number | null {
  const rows = points
    .filter(p => p.value != null)
    .map(p => ({ x: dayNumber(p.date), y: p.value as number }))
  if (rows.length < 3) return null

  const mx = mean(rows.map(r => r.x))!
  const my = mean(rows.map(r => r.y))!
  const denom = sum(rows.map(r => (r.x - mx) ** 2))
  if (denom === 0) return null
  return sum(rows.map(r => (r.x - mx) * (r.y - my))) / denom
}

/** Pearson r over the days both series have a reading for. */
export function correlation(a: Point[], b: Point[]): { r: number; n: number } | null {
  const byDate = new Map(b.filter(p => p.value != null).map(p => [p.date, p.value as number]))
  const pairs = a
    .filter(p => p.value != null && byDate.has(p.date))
    .map(p => [p.value as number, byDate.get(p.date)!] as const)

  if (pairs.length < 3) return null
  const mx = mean(pairs.map(p => p[0]))!
  const my = mean(pairs.map(p => p[1]))!
  const sx = Math.sqrt(sum(pairs.map(p => (p[0] - mx) ** 2)))
  const sy = Math.sqrt(sum(pairs.map(p => (p[1] - my) ** 2)))
  if (sx === 0 || sy === 0) return null
  return { r: sum(pairs.map(p => (p[0] - mx) * (p[1] - my))) / (sx * sy), n: pairs.length }
}

/** Shifts a series forward by whole days, for "last night against today". */
export function lag(points: Point[], days: number): Point[] {
  return points.map(p => ({ date: shift(p.date, days), value: p.value }))
}

/** Share of days whose reading sits within `tolerance` of the goal, 0–1. */
export function adherence(points: Point[], goal: number, tolerance = 0.1): { rate: number; hit: number; total: number } | null {
  const values = defined(points)
  if (values.length === 0 || goal <= 0) return null
  const hit = values.filter(v => Math.abs(v - goal) <= goal * tolerance).length
  return { rate: hit / values.length, hit, total: values.length }
}

export interface Bucket {
  /** Monday of the week, as the label and the sort key. */
  date: string
  value: number | null
  count: number
}

/** Groups dated values into Monday-anchored weeks, summed or averaged. */
export function byWeek(points: Point[], how: 'sum' | 'mean' = 'sum'): Bucket[] {
  const weeks = new Map<string, number[]>()
  for (const p of points) {
    if (p.value == null) continue
    const key = mondayOf(p.date)
    const bucket = weeks.get(key)
    if (bucket) bucket.push(p.value)
    else weeks.set(key, [p.value])
  }
  return [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      date,
      value: how === 'sum' ? sum(values) : mean(values),
      count: values.length,
    }))
}

/** Averages per weekday, index 0 = Monday, so the week reads left to right. */
export function byWeekday(points: Point[]): (number | null)[] {
  const buckets: number[][] = [[], [], [], [], [], [], []]
  for (const p of points) {
    if (p.value == null) continue
    buckets[weekdayIndex(p.date)].push(p.value)
  }
  return buckets.map(mean)
}

/**
 * Fills a series out to one entry per calendar day between the bounds.
 *
 * Charts space points evenly, so a series that only holds the days that were
 * logged would show a two-week gap and a one-day gap at the same width.
 */
export function densify(points: Point[], from: string, to: string): Point[] {
  const known = new Map(points.map(p => [p.date, p.value]))
  const out: Point[] = []
  for (let d = from; d <= to; d = shift(d, 1)) {
    out.push({ date: d, value: known.get(d) ?? null })
  }
  return out
}

/** The last reading in the series, ignoring the trailing gap. */
export function latest(points: Point[]): number | null {
  for (let i = points.length - 1; i >= 0; i--) if (points[i].value != null) return points[i].value
  return null
}

/**
 * Clock times on an axis that runs through the night rather than through
 * midnight.
 *
 * On a plain minutes-since-midnight axis, going to bed at 23:50 and at 00:10
 * are twenty hours apart, and an average of the two lands at lunchtime. The
 * axis below starts at noon, so an evening and the small hours that follow it
 * are neighbours and the arithmetic means what it says.
 */
export function clockToNightAxis(hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return (h * 60 + m + 720) % 1440
}

/** Back to a readable "HH:mm" from that axis. */
export function nightAxisToClock(value: number): string {
  const minutes = ((Math.round(value) % 1440) + 1440 + 720) % 1440
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * The middle of the night, on the same axis: the single number sleep research
 * uses for regularity, because going to bed late and getting up late is a
 * shifted night, not a broken one.
 */
export function sleepMidpoint(bedTime: string | null, wakeTime: string | null): number | null {
  const bed = bedTime ? clockToNightAxis(bedTime) : null
  const wake = wakeTime ? clockToNightAxis(wakeTime) : null
  if (bed == null || wake == null) return null
  const span = wake >= bed ? wake - bed : wake - bed + 1440
  return bed + span / 2
}

/** Epley one-rep-max estimate. Above ~12 reps the formula stops being useful. */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null
  return weightKg * (1 + reps / 30)
}

// ── date helpers, kept local so this module has no import cycle ──────────────

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

function format(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function shift(iso: string, days: number): string {
  const d = parse(iso)
  d.setDate(d.getDate() + days)
  return format(d)
}

/** Whole days since the epoch, for the regression's x axis. */
export function dayNumber(iso: string): number {
  return Math.round(parse(iso).getTime() / 86_400_000)
}

/** Monday of the week the date falls in. */
export function mondayOf(iso: string): string {
  const d = parse(iso)
  return shift(iso, -(((d.getDay() + 6) % 7)))
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (parse(iso).getDay() + 6) % 7
}
