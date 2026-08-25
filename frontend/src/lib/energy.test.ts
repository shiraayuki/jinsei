import { describe, expect, it } from 'vitest'
import { anchorWeight, measuredTdee, rateKeyFor, targetIntake, weeklyChangeFor, weeklyLossKg } from './energy'

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

describe('rate presets', () => {
  it('names the preset a stored percentage belongs to', () => {
    expect(rateKeyFor(0.35)).toBe('gentle')
    expect(rateKeyFor(0.6)).toBe('standard')
    expect(rateKeyFor(0.9)).toBe('aggressive')
    expect(rateKeyFor(null)).toBeNull()
  })

  it('scales the weekly loss with body weight', () => {
    // The same pace is a different number of kilos at a different size — which
    // is the whole reason it is a percentage.
    expect(weeklyLossKg(81.4, 0.6)).toBeCloseTo(0.4884, 4)
    expect(weeklyLossKg(60, 0.6)).toBeCloseTo(0.36, 4)
  })

  it('turns the pace into an intake against measured maintenance', () => {
    // 0.49 kg a week is about 537 kcal a day off a 3000 kcal maintenance.
    expect(targetIntake(3000, weeklyLossKg(81.4, 0.6))).toBeCloseTo(3000 - 537.24, 1)
  })
})

describe('anchorWeight', () => {
  const day = (n: number) => `2026-08-${String(n).padStart(2, '0')}`
  // 2026-08-24 is a Monday.
  const points = Array.from({ length: 12 }, (_, i) => ({ date: day(14 + i), value: 82 - i * 0.1 }))

  it('freezes on the trend value at the start of the week', () => {
    const midweek = anchorWeight(points, '2026-08-27')!
    const monday = anchorWeight(points, '2026-08-24')!
    // Wednesday's target is computed from the same weight Monday's was, even
    // though three more weigh-ins have landed since.
    expect(midweek).toBeCloseTo(monday, 6)
  })

  it('ignores the daily swing a single weigh-in adds', () => {
    const spiked = [...points, { date: '2026-08-25', value: 84.5 }]
    expect(anchorWeight(spiked, '2026-08-26')!).toBeCloseTo(anchorWeight(points, '2026-08-26')!, 6)
  })

  it('falls back to what is known in a first week with no history', () => {
    const fresh = [
      { date: '2026-08-24', value: 80 },
      { date: '2026-08-25', value: 80.4 },
      { date: '2026-08-26', value: 80.2 },
    ]
    expect(anchorWeight(fresh, '2026-08-26')).toBeCloseTo(80.2, 1)
  })

  it('says nothing without weigh-ins', () => {
    expect(anchorWeight([{ date: '2026-08-24', value: null }], '2026-08-26')).toBeNull()
  })
})
