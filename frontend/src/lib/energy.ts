/**
 * Three ways of answering "how much do I burn", in order of how much they know.
 *
 * The formula knows your size and your age and nothing else. The derived
 * estimate adds what the app actually logged — the steps you walked and the
 * sessions you trained — instead of asking you to pick a lifestyle from a list.
 * The measured estimate is the real answer, intake against what the scale did,
 * but it needs a fortnight of both before it says anything honest.
 *
 * Each one takes over from the one before it as soon as it has what it needs.
 */

/** A kilogram of body mass is roughly this many kilocalories of stored energy. */
export const KCAL_PER_KG = 7700

export interface BodyProfile {
  birthDate: string | null
  heightCm: number | null
  sex: string | null
  /** The occupation factor: what the day costs before steps and training. */
  activityLevel: number | null
}

/**
 * What the working day costs on its own.
 *
 * These sit far below the familiar 1.2–1.9 table because they carry only the
 * job: the walking and the training are counted from the logs rather than
 * bundled into the multiplier, which is what makes the two double up in every
 * calculator that asks for both.
 */
export const JOB_LEVELS = [
  { value: 1.2, key: 'desk' },
  { value: 1.4, key: 'standing' },
  { value: 1.6, key: 'physical' },
] as const

export const DEFAULT_JOB_LEVEL = 1.2

/**
 * Steps a sedentary day already contains, and which the job factor therefore
 * already paid for. Only what is walked beyond this is counted again.
 */
const STEPS_IN_JOB_FACTOR = 2500

/** Net kilocalories per step and kilogram of body weight, walking on the flat. */
const KCAL_PER_STEP_PER_KG = 0.00045

/** Resistance training, in METs. Net cost is one MET below this — you would
 *  have been burning the resting one anyway. */
const TRAINING_METS = 5

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

/** Net kilocalories for a day's steps, beyond the ones the job already covers. */
export function stepCost(steps: number, weightKg: number): number {
  return Math.max(0, steps - STEPS_IN_JOB_FACTOR) * KCAL_PER_STEP_PER_KG * weightKg
}

/** Net kilocalories for a training session of this length. */
export function trainingCost(minutes: number, weightKg: number): number {
  return ((TRAINING_METS - 1) * 3.5 * weightKg / 200) * Math.max(0, minutes)
}

export interface EnergyBreakdown {
  restingKcal: number
  /** What the working day adds on top of resting. */
  jobKcal: number
  stepKcal: number
  trainingKcal: number
  total: number
  /** The multiplier this works out to, for comparison with the usual table. */
  impliedFactor: number
}

/**
 * The estimate built from what was logged: resting rate, the job, the steps
 * actually walked and the minutes actually trained.
 *
 * Training minutes come in per week and are spread across all seven days —
 * maintenance is a weekly average worn as a daily number, not a figure that
 * should jump on leg day.
 */
export function derivedTdee({
  weightKg,
  profile,
  meanSteps,
  weeklyTrainingMinutes,
}: {
  weightKg: number
  profile: BodyProfile
  meanSteps: number | null
  weeklyTrainingMinutes: number | null
}): EnergyBreakdown | null {
  const resting = restingRate(weightKg, profile)
  if (resting == null) return null

  const jobKcal = resting * ((profile.activityLevel ?? DEFAULT_JOB_LEVEL) - 1)
  const stepKcal = meanSteps != null ? stepCost(meanSteps, weightKg) : 0
  const trainingKcal = weeklyTrainingMinutes != null ? trainingCost(weeklyTrainingMinutes, weightKg) / 7 : 0
  const total = resting + jobKcal + stepKcal + trainingKcal

  return {
    restingKcal: resting,
    jobKcal,
    stepKcal,
    trainingKcal,
    total,
    impliedFactor: total / resting,
  }
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
