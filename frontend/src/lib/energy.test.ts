import { describe, expect, it } from 'vitest'
import { ageOn, derivedTdee, measuredTdee, restingRate, stepCost, trainingCost, weeklyChangeFor } from './energy'

const profile = { birthDate: '1996-08-30', heightCm: 183, sex: 'male', activityLevel: 1.2 }

describe('ageOn', () => {
  it('does not count a birthday that has not happened yet', () => {
    expect(ageOn('1996-08-30', new Date(2026, 7, 25))).toBe(29)
    expect(ageOn('1996-08-30', new Date(2026, 8, 1))).toBe(30)
  })
})

describe('restingRate', () => {
  it('follows Mifflin-St Jeor', () => {
    // 10·81.4 + 6.25·183 − 5·29 + 5 = 1817.75
    expect(restingRate(81.4, profile)!).toBeCloseTo(1817.75, 2)
  })

  it('takes the midpoint of the constants when no sex was stated', () => {
    const stated = restingRate(81.4, { ...profile, sex: 'male' })!
    const unstated = restingRate(81.4, { ...profile, sex: null })!
    expect(stated - unstated).toBe(83)
  })

  it('says nothing without height or birth date', () => {
    expect(restingRate(81.4, { ...profile, heightCm: null })).toBeNull()
    expect(restingRate(81.4, { ...profile, birthDate: null })).toBeNull()
  })
})

describe('stepCost', () => {
  it('only counts the steps beyond the ones the job factor already paid for', () => {
    // 10.000 steps at 81.4 kg, minus the 2.500 a desk day already contains.
    expect(stepCost(10_000, 81.4)).toBeCloseTo(7500 * 0.00045 * 81.4, 4)
  })

  it('is nothing for a day spent at the desk', () => {
    expect(stepCost(1200, 81.4)).toBe(0)
  })
})

describe('trainingCost', () => {
  it('charges four net METs for the minutes trained', () => {
    expect(trainingCost(60, 81.4)).toBeCloseTo((4 * 3.5 * 81.4 / 200) * 60, 4)
  })
})

describe('derivedTdee', () => {
  const args = { weightKg: 81.4, profile, meanSteps: 10_000, weeklyTrainingMinutes: 360 }

  it('adds the job, the steps and the training onto the resting rate', () => {
    const result = derivedTdee(args)!
    expect(result.restingKcal).toBeCloseTo(1817.75, 2)
    expect(result.jobKcal).toBeCloseTo(1817.75 * 0.2, 2)
    expect(result.stepKcal).toBeCloseTo(stepCost(10_000, 81.4), 4)
    // Six hours a week worn as a daily number: maintenance is a weekly
    // average, not a figure that jumps on leg day.
    expect(result.trainingKcal).toBeCloseTo(trainingCost(360, 81.4) / 7, 4)
    expect(result.total).toBeCloseTo(
      result.restingKcal + result.jobKcal + result.stepKcal + result.trainingKcal, 6,
    )
  })

  it('reports the multiplier it works out to', () => {
    const result = derivedTdee(args)!
    expect(result.impliedFactor).toBeCloseTo(result.total / result.restingKcal, 6)
    expect(result.impliedFactor).toBeGreaterThan(1.2)
    expect(result.impliedFactor).toBeLessThan(1.9)
  })

  it('carries the job alone when nothing was logged', () => {
    const result = derivedTdee({ ...args, meanSteps: null, weeklyTrainingMinutes: null })!
    expect(result.stepKcal).toBe(0)
    expect(result.trainingKcal).toBe(0)
    expect(result.impliedFactor).toBeCloseTo(1.2, 6)
  })

  it('says nothing without the body data the resting rate needs', () => {
    expect(derivedTdee({ ...args, profile: { ...profile, heightCm: null } })).toBeNull()
  })
})

describe('measuredTdee', () => {
  it('adds back the energy that came out of storage', () => {
    // Half a kilo a week down on 2000 kcal means about 550 kcal a day came
    // from the body itself.
    expect(measuredTdee(2000, -0.5)).toBeCloseTo(2550, 0)
  })

  it('is the intake itself when the weight holds', () => {
    expect(measuredTdee(2400, 0)).toBe(2400)
  })
})

describe('weeklyChangeFor', () => {
  it('turns a daily gap into kilograms a week', () => {
    expect(weeklyChangeFor(-550)).toBeCloseTo(-0.5, 2)
  })
})
