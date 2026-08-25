/**
 * Two ways of answering "how much do I burn", kept apart on purpose.
 *
 * The formula is a starting point: it knows your size and your age and nothing
 * about you. The measured estimate is the real answer — intake against what the
 * scale actually did — but it needs a fortnight of both before it says anything
 * honest. The app shows the formula until the measurement can take over.
 */

/** A kilogram of body mass is roughly this many kilocalories of stored energy. */
export const KCAL_PER_KG = 7700

export interface BodyProfile {
  birthDate: string | null
  heightCm: number | null
  sex: string | null
  activityLevel: number | null
}

/** How much the day moves, as the multiplier on the resting rate. */
export const ACTIVITY_LEVELS = [
  { value: 1.2, key: 'sedentary' },
  { value: 1.375, key: 'light' },
  { value: 1.55, key: 'moderate' },
  { value: 1.725, key: 'high' },
  { value: 1.9, key: 'athlete' },
] as const

export function ageOn(birthDate: string, on = new Date()): number | null {
  const born = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(born.getTime())) return null
  let age = on.getFullYear() - born.getFullYear()
  const monthDiff = on.getMonth() - born.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < born.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

/**
 * Resting rate by Mifflin-St Jeor, the formula that holds up best against
 * measured metabolic rate in people who are not athletes.
 *
 * Without a stated sex it takes the midpoint of the two constants rather than
 * refusing to answer: being off by eighty kilocalories beats showing nothing.
 */
export function restingRate(weightKg: number, profile: BodyProfile): number | null {
  const { heightCm, birthDate, sex } = profile
  if (weightKg <= 0 || heightCm == null || birthDate == null) return null
  const age = ageOn(birthDate)
  if (age == null) return null

  const constant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78
  return 10 * weightKg + 6.25 * heightCm - 5 * age + constant
}

/** The resting rate carried through a day of the stated activity. */
export function formulaTdee(weightKg: number, profile: BodyProfile): number | null {
  const bmr = restingRate(weightKg, profile)
  if (bmr == null) return null
  return bmr * (profile.activityLevel ?? 1.375)
}

/**
 * Maintenance from what actually happened: average intake plus the energy that
 * came out of, or went into, storage.
 *
 * `ratePerWeek` is the trend line's slope in kilograms per week, not the
 * difference between two weigh-ins — a salty dinner moves the scale by more
 * than a week of deficit does.
 */
export function measuredTdee(meanKcal: number, ratePerWeek: number): number {
  return meanKcal - (ratePerWeek / 7) * KCAL_PER_KG
}

/** The weekly weight change a given daily gap would produce, in kilograms. */
export function weeklyChangeFor(dailyGapKcal: number): number {
  return (dailyGapKcal * 7) / KCAL_PER_KG
}
