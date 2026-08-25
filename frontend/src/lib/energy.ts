/**
 * What maintenance actually is, measured rather than modelled.
 *
 * There was a formula here once — resting rate, an occupation factor, the cost
 * of the steps walked and the minutes trained. It was removed because it
 * answered the same question twice with two different numbers, and the reader
 * then had to decide which to believe. The measurement below needs two weeks of
 * patience and is right; a formula is available immediately and is not.
 */

import { latest, mondayOf, movingAverage, type Point } from './stats'

/** A kilogram of body mass is roughly this many kilocalories of stored energy. */
export const KCAL_PER_KG = 7700

/** Logged calorie days and weigh-ins before the estimate is worth showing. */
export const MIN_KCAL_DAYS = 14
export const MIN_WEIGH_INS = 8

/**
 * Maintenance from what actually happened: average intake plus the energy that
 * came out of, or went into, storage.
 *
 * `ratePerWeek` is the trend line's slope in kilograms per week, not the
 * difference between two weigh-ins — a salty dinner moves the scale by more
 * than a week of deficit does. Because the slope carries every cost there is,
 * including the ones no model has a term for, this needs nothing about your
 * height, your age or how you spend your day.
 */
export function measuredTdee(meanKcal: number, ratePerWeek: number): number {
  return meanKcal - (ratePerWeek / 7) * KCAL_PER_KG
}

/** The weekly weight change a given daily gap would produce, in kilograms. */
export function weeklyChangeFor(dailyGapKcal: number): number {
  return (dailyGapKcal * 7) / KCAL_PER_KG
}

/**
 * How fast to move, as a share of body weight per week.
 *
 * The percentages come from what happens to fat-free mass at each pace: below
 * about 0.4 % a week it can still creep up, between 0.5 and 0.7 % it holds,
 * and past 0.8 % it starts coming off with the fat. A percentage rather than a
 * fixed number of kilos, because half a kilo a week is a gentle cut at 100 kg
 * and a brutal one at 60.
 */
export const RATE_PRESETS = [
  { key: 'gentle', percent: 0.35 },
  { key: 'standard', percent: 0.6 },
  { key: 'aggressive', percent: 0.9 },
] as const

export type RateKey = (typeof RATE_PRESETS)[number]['key']

/** The preset a stored percentage belongs to, for showing which one is active. */
export function rateKeyFor(percent: number | null): RateKey | null {
  if (percent == null) return null
  return RATE_PRESETS.reduce<RateKey>(
    (best, preset) =>
      Math.abs(preset.percent - percent) < Math.abs(RATE_PRESETS.find(p => p.key === best)!.percent - percent)
        ? preset.key
        : best,
    RATE_PRESETS[0].key,
  )
}

/**
 * The weight the week's target is computed from.
 *
 * Not the last weigh-in: that swings by a kilo on salt and water alone, which
 * would move the calorie target by sixty kilocalories from one morning to the
 * next. The trend weight, frozen at this week's Monday — so the number holds
 * still for seven days and then steps down on its own as the trend does.
 */
export function anchorWeight(weightPoints: Point[], today: string): number | null {
  const trend = movingAverage(weightPoints, 7, 3)
  const monday = mondayOf(today)
  const settled = trend.filter(p => p.date <= monday)
  // A first week with nothing behind it falls back to what is known, rather
  // than withholding a target until next Monday.
  return latest(settled) ?? latest(trend)
}

/** What the chosen pace works out to in kilograms for this week. */
export function weeklyLossKg(anchorKg: number, percent: number): number {
  return anchorKg * (percent / 100)
}

/** The intake that pace calls for, given what maintenance actually is. */
export function targetIntake(tdee: number, weeklyKg: number): number {
  return tdee - (weeklyKg * KCAL_PER_KG) / 7
}
