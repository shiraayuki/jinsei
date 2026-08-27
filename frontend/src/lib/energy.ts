/**
 * What is left of the energy arithmetic on this side.
 *
 * Maintenance, the anchor weight and the week's target used to be worked out
 * here, over whatever range the chart above them happened to be showing — so
 * the target moved when the range switch did, and the button then wrote a
 * different figure than a weekly job would have. That calculation now lives in
 * `EnergyService` on the server, over one fixed four-week window, and is read
 * through `features/energy/hooks`. What stays here is the pace, which is a
 * decision rather than a measurement, and the two constants a screen needs to
 * say what a number means.
 */

/** A kilogram of body mass is roughly this many kilocalories of stored energy. */
export const KCAL_PER_KG = 7700

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
