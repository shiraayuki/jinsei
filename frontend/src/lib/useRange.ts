import { useEffect, useState } from 'react'

/**
 * The remembered time range behind the range switch.
 *
 * Four presets rather than a date picker: the picker costs a screen and gets
 * used twice. The choice is stored per key, so leaving the metrics page on 90
 * days and coming back does not silently reset the reading.
 */
export const RANGES = [7, 30, 90, 365] as const
export type Range = (typeof RANGES)[number]

function read(key: string, fallback: Range): Range {
  try {
    const stored = Number(localStorage.getItem(`jinsei.range.${key}`))
    return (RANGES as readonly number[]).includes(stored) ? (stored as Range) : fallback
  } catch {
    // Private mode and blocked site data both throw here; the default is fine.
    return fallback
  }
}

export function useRange(key: string, fallback: Range = 30) {
  const [days, setDays] = useState<Range>(() => read(key, fallback))

  useEffect(() => {
    try {
      localStorage.setItem(`jinsei.range.${key}`, String(days))
    } catch {
      /* nothing to do: the range is a convenience, not state we owe anyone */
    }
  }, [key, days])

  return [days, setDays] as const
}
