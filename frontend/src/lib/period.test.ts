import { describe, expect, it } from 'vitest'
import { daysBetween, periodRange } from './period'

describe('periodRange', () => {
  it('starts the week on Monday rather than seven days ago', () => {
    // A Thursday: the week holds four days, not seven.
    const range = periodRange('week', '2026-08-27')
    expect(range.from).toBe('2026-08-24')
    expect(range.to).toBe('2026-08-27')
    expect(daysBetween(range.from, range.to)).toBe(4)
  })

  it('treats Sunday as the end of the week, not the start', () => {
    expect(periodRange('week', '2026-08-23').from).toBe('2026-08-17')
  })

  it('compares against the same weekdays of the week before', () => {
    const range = periodRange('week', '2026-08-27')
    expect(range.previousFrom).toBe('2026-08-17')
    expect(range.previousTo).toBe('2026-08-20')
  })

  it('starts the month on the first', () => {
    const range = periodRange('month', '2026-08-27')
    expect(range.from).toBe('2026-08-01')
    expect(range.previousFrom).toBe('2026-07-01')
    expect(range.previousTo).toBe('2026-07-27')
  })

  it('trails six and twelve months back for the long periods', () => {
    expect(periodRange('halfYear', '2026-08-27').from).toBe('2026-02-28')
    expect(periodRange('year', '2026-08-27').from).toBe('2025-08-28')
  })

  it('asks for enough history to cover the comparison too', () => {
    const range = periodRange('week', '2026-08-27')
    expect(range.days).toBe(daysBetween(range.previousFrom, range.to))
    expect(range.days).toBe(11)
  })
})
