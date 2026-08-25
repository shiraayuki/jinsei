import { describe, expect, it } from 'vitest'
import { ageOn, formulaTdee, measuredTdee, restingRate, weeklyChangeFor } from './energy'

const profile = { birthDate: '1996-08-30', heightCm: 183, sex: 'male', activityLevel: 1.55 }

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

describe('formulaTdee', () => {
  it('carries the resting rate through the stated activity', () => {
    expect(formulaTdee(81.4, profile)!).toBeCloseTo(1817.75 * 1.55, 2)
  })

  it('assumes a lightly active day when no level was chosen', () => {
    expect(formulaTdee(81.4, { ...profile, activityLevel: null })!).toBeCloseTo(1817.75 * 1.375, 2)
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
