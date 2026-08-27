import { Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNutrition } from '../../../features/nutrition/hooks'
import { useSleep } from '../../../features/sleep/hooks'
import { useWeight } from '../../../features/weight/hooks'
import { useWorkouts } from '../../../features/workouts/hooks'
import { correlation, lag, movingAverage, type Point } from '../../../lib/stats'
import { Block, EmptyHint } from '../Block'
import { series } from '../shared'
import { moduleColor } from '../../../lib/modules'

/** Below this many paired days a coefficient is noise wearing a number. */
const MIN_PAIRS = 14

export function CorrelationsSection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { data: sleep = [] } = useSleep(days)
  const { data: nutrition = [] } = useNutrition(days)
  const { data: weight = [] } = useWeight(days)
  const { data: workouts = [] } = useWorkouts(days)

  const sleepMinutes = series(sleep, e => e.actualSleepMinutes ?? e.timeInBedMinutes, days)
  const kcal = series(nutrition, e => e.kcal, days)
  const weightPoints = series(weight, e => e.weightKg, days)

  // Several sessions on one day are one day's training load.
  const volumeByDay = new Map<string, number>()
  for (const w of workouts) volumeByDay.set(w.date, (volumeByDay.get(w.date) ?? 0) + w.volumeKg)
  const volume: Point[] = sleepMinutes.map(p => ({ date: p.date, value: volumeByDay.get(p.date) ?? null }))

  const rows = [
    // Sleep is credited to the day after it, which is the day it has to carry.
    { label: t('metrics.correlations.sleepVsVolume'), result: correlation(lag(sleepMinutes, 1), volume) },
    // Both sides smoothed: the question is whether a week of intake moved the
    // trend, not whether yesterday's dinner moved this morning's scale.
    {
      label: t('metrics.correlations.caloriesVsWeight'),
      result: correlation(movingAverage(kcal, 7, 3), movingAverage(weightPoints, 7, 3)),
    },
  ].filter(r => r.result != null && r.result.n >= MIN_PAIRS)

  return (
    <Block module="mind" icon={<Link2 size={15} />} title={t('metrics.correlations.title')}>
      {rows.length === 0 ? (
        <EmptyHint text={t('metrics.correlations.empty')} />
      ) : (
        <>
          <div className="space-y-2">
            {rows.map(row => (
              <CorrelationRow key={row.label} label={row.label} r={row.result!.r} n={row.result!.n} />
            ))}
          </div>
          <p className="text-label text-ink-faint">{t('metrics.correlations.hint')}</p>
        </>
      )}
    </Block>
  )
}

function CorrelationRow({ label, r, n }: { label: string; r: number; n: number }) {
  const { t } = useTranslation()
  const strength = Math.abs(r)
  const word =
    strength >= 0.5
      ? t('metrics.correlations.strong')
      : strength >= 0.3
        ? t('metrics.correlations.moderate')
        : strength >= 0.15
          ? t('metrics.correlations.weak')
          : t('metrics.correlations.none')

  return (
    <div className="rounded-control bg-raised p-3">
      <p className="text-meta text-ink-soft">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {/* The bar runs out from the middle, so direction reads before size. */}
        <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="absolute top-0 h-full"
            style={{
              left: r >= 0 ? '50%' : `${50 - strength * 50}%`,
              width: `${strength * 50}%`,
              background: r >= 0 ? moduleColor.food : moduleColor.mind,
            }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px" style={{ background: 'var(--line-strong)' }} />
        </div>
        <span className="w-28 shrink-0 text-right text-label text-ink-faint tabular">
          {word} · {t('metrics.correlations.nights', { count: n })}
        </span>
      </div>
    </div>
  )
}
