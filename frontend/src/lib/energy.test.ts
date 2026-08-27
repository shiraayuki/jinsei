import { describe, expect, it } from 'vitest'
import { rateKeyFor, weeklyChangeFor } from './energy'

describe('weeklyChangeFor', () => {
  it('turns a daily gap into kilograms a week', () => {
    // 500 kcal a day is the half-kilo-a-week rule of thumb.
    expect(weeklyChangeFor(-500)).toBeCloseTo(-0.4545, 3)
  })

  it('is zero at maintenance', () => {
    expect(weeklyChangeFor(0)).toBe(0)
  })
})

describe('rateKeyFor', () => {
  it('names the preset a stored percentage belongs to', () => {
    expect(rateKeyFor(0.35)).toBe('gentle')
    expect(rateKeyFor(0.6)).toBe('standard')
    expect(rateKeyFor(0.9)).toBe('aggressive')
  })

  it('picks the nearest one for a value that was never a preset', () => {
    expect(rateKeyFor(0.5)).toBe('standard')
  })

  it('has nothing to name when no rate is set', () => {
    expect(rateKeyFor(null)).toBeNull()
  })
})
