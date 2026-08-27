import { useEffect, useState } from 'react'
import { shiftIso, toIsoDate, todayIso } from './date'

/**
 * The reading window for the numbers that are counted rather than trended.
 *
 * A trailing window is the wrong answer for "how often did I train this week":
 * the last seven days reach back into the week before and report five sessions
 * for a week that had three. The first two periods are therefore calendar
 * periods — this week from Monday, this month from the first — and only the two
 * long ones, where no one thinks in calendar boundaries, trail from today.
 */
export const PERIODS = ['week', 'month', 'halfYear', 'year'] as const
export type Period = (typeof PERIODS)[number]

export interface PeriodRange {
  /** First and last day of the period being read, inclusive. */
  from: string
  to: string
  /**
   * The comparable stretch one period earlier: the same number of days, so a
   * Wednesday is compared against last week up to its Wednesday and not
   * against a whole week that has already finished.
   */
  previousFrom: string
  previousTo: string
  /** Days of history to ask the API for, covering both stretches. */
  days: number
}

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

/** Whole days from one date to the other, both ends counted. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000) + 1
}

/** The Monday of the week the date falls in. */
function mondayOf(iso: string): string {
  const date = parse(iso)
  // getDay() is 0 on Sunday, which is the end of the week here, not the start.
  return shiftIso(iso, -((date.getDay() + 6) % 7))
}

/**
 * The same calendar date some months earlier, clamped to the last day of the
 * month it lands in: a month before 31 March is 28 February, not 3 March.
 */
function shiftMonths(iso: string, months: number): string {
  const date = parse(iso)
  const day = date.getDate()
  const shifted = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()
  shifted.setDate(Math.min(day, lastDay))
  return toIsoDate(shifted)
}

export function periodRange(period: Period, today = todayIso()): PeriodRange {
  const to = today

  const from =
    period === 'week' ? mondayOf(today)
    : period === 'month' ? `${today.slice(0, 7)}-01`
    : period === 'halfYear' ? shiftIso(shiftMonths(today, -6), 1)
    : shiftIso(shiftMonths(today, -12), 1)

  const length = daysBetween(from, to)

  // The previous stretch starts one period back and runs as many days as have
  // passed in this one. For the calendar periods that is the same weekday or
  // the same day of the month; for the trailing ones it is simply the window
  // before this one.
  const previousFrom =
    period === 'week' ? shiftIso(from, -7)
    : period === 'month' ? shiftMonths(from, -1)
    : shiftIso(from, -length)

  return {
    from,
    to,
    previousFrom,
    previousTo: shiftIso(previousFrom, length - 1),
    days: daysBetween(previousFrom, to),
  }
}

/**
 * The remembered period behind the period switch, stored per key the same way
 * the range switch is — leaving the page on "this month" and coming back should
 * not silently reset the reading.
 */
export function usePeriod(key: string, fallback: Period = 'week') {
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const stored = localStorage.getItem(`jinsei.period.${key}`)
      return PERIODS.includes(stored as Period) ? (stored as Period) : fallback
    } catch {
      // Private mode and blocked site data both throw here; the default is fine.
      return fallback
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(`jinsei.period.${key}`, period)
    } catch {
      /* nothing to do: the period is a convenience, not state we owe anyone */
    }
  }, [key, period])

  return [period, setPeriod] as const
}
