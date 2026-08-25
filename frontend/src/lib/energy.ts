/**
 * What maintenance actually is, measured rather than modelled.
 *
 * There was a formula here once — resting rate, an occupation factor, the cost
 * of the steps walked and the minutes trained. It was removed because it
 * answered the same question twice with two different numbers, and the reader
 * then had to decide which to believe. The measurement below needs two weeks of
 * patience and is right; a formula is available immediately and is not.
 */

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
