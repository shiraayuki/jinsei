import { describe, expect, it } from 'vitest'
import { measuredTdee, weeklyChangeFor } from './energy'

describe('measuredTdee', () => {
  it('adds back the energy that came out of storage', () => {
    // Half a kilo a week down on 2000 kcal means about 550 kcal a day came
    // from the body itself.
    expect(measuredTdee(2000, -0.5)).toBeCloseTo(2550, 0)
  })

  it('subtracts the energy that went into it', () => {
    expect(measuredTdee(3000, 0.25)).toBeCloseTo(2725, 0)
  })

  it('is the intake itself when the weight holds', () => {
    expect(measuredTdee(2400, 0)).toBe(2400)
  })
})

describe('weeklyChangeFor', () => {
  it('turns a daily gap into kilograms a week', () => {
    expect(weeklyChangeFor(-550)).toBeCloseTo(-0.5, 2)
  })

  it('is symmetric', () => {
    expect(weeklyChangeFor(550)).toBeCloseTo(0.5, 2)
  })
})
