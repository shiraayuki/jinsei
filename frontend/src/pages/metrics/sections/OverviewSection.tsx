import { Activity, CalendarDays, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StatTile } from '../../../components/charts/StatTile'
import { MacroSplit } from '../../../components/charts/MacroSplit'
import { useActivity } from '../../../features/activity/hooks'
import { useNutrition } from '../../../features/nutrition/hooks'
import { useSleep } from '../../../features/sleep/hooks'
import { useWeight } from '../../../features/weight/hooks'
import { useWorkouts } from '../../../features/workouts/hooks'
import { dateLocale } from '../../../i18n'
import { periodRange, type Period } from '../../../lib/period'
import { mean, movingAverage, type Point } from '../../../lib/stats'
import { Block } from '../Block'
import { duration, num, series } from '../shared'

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
}

/** The value the series carries on a given day, or null if it has none. */
function valueAt(points: Point[], date: string): number | null {
  return points.find(p => p.date === date)?.value ?? null
}

/**
 * The numbers that answer "how did this period go" — one card, no charts.
 *
 * It counts over a calendar period rather than a trailing window: a trailing
 * seven days reaches back into the week before and reports five sessions for a
 * week that had three. The charts live in the tabs that are about them; this
 * page is the one you open to find out whether any of them needs opening.
 */
export function OverviewSection({ period }: { period: Period }) {
  const { t } = useTranslation()

  const range = periodRange(period)
  // Enough history for the period, the stretch it is compared against, and the
  // week of readings the weight trend needs before either of them starts.
  const history = range.days + 7

  const { data: workouts = [] } = useWorkouts(history)
  const { data: sleep = [] } = useSleep(history)
  const { data: nutrition = [] } = useNutrition(history)
  const { data: activity = [] } = useActivity(history)
  const { data: weight = [] } = useWeight(history)

  const inPeriod = (date: string) => date >= range.from && date <= range.to
  const inPrevious = (date: string) => date >= range.previousFrom && date <= range.previousTo

  /** The mean of the days that carry a reading; an unlogged day is not a zero. */
  function meanOf<T extends { date: string }>(
    rows: T[],
    pick: (row: T) => number | null,
    within: (date: string) => boolean,
  ): number | null {
    return mean(rows.filter(r => within(r.date)).map(pick).filter((v): v is number => v != null))
  }

  const sessions = workouts.filter(w => inPeriod(w.date)).length
  const sessionsBefore = workouts.filter(w => inPrevious(w.date)).length

  const sleepNow = meanOf(sleep, e => e.actualSleepMinutes ?? e.timeInBedMinutes, inPeriod)
  const sleepBefore = meanOf(sleep, e => e.actualSleepMinutes ?? e.timeInBedMinutes, inPrevious)
  const kcalNow = meanOf(nutrition, e => e.kcal, inPeriod)
  const kcalBefore = meanOf(nutrition, e => e.kcal, inPrevious)
  const stepsNow = meanOf(activity, e => e.steps, inPeriod)
  const stepsBefore = meanOf(activity, e => e.steps, inPrevious)

  // Averaged one macro at a time rather than off the mean day: a day that
  // logged calories but no macros would otherwise drag all three down.
  const proteinNow = meanOf(nutrition, e => e.proteinG, inPeriod)
  const carbsNow = meanOf(nutrition, e => e.carbsG, inPeriod)
  const fatNow = meanOf(nutrition, e => e.fatG, inPeriod)
  const hasMacros = proteinNow != null || carbsNow != null || fatNow != null

  // The trend weight, not the last weigh-in: a single morning swings by more
  // than a week of eating does. The delta is the trend at the end of the period
  // against the trend where the period started.
  const weightPoints = series(weight, e => e.weightKg, history)
  const weightTrend = movingAverage(weightPoints, 7, 3)
  const weightNow = valueAt(weightTrend, range.to)
  const weightBefore = valueAt(weightTrend, range.from)

  const nothing =
    workouts.length === 0 && sleep.length === 0 && nutrition.length === 0 &&
    activity.length === 0 && weight.length === 0

  if (nothing) {
    return (
      <Block module="train" icon={<Activity size={17} />} title={t('metrics.tabs.overview')}>
        <p className="py-8 text-center text-body text-ink-mute">{t('metrics.empty')}</p>
      </Block>
    )
  }

  return (
    <Block
      module="train"
      icon={<Activity size={17} />}
      title={t(`metrics.periods.${period}`)}
      summary={`${formatDay(range.from)} – ${formatDay(range.to)}`}
    >
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label={t('nav.workouts')}
          value={num(sessions)}
          hint={t('metrics.periodTotal')}
          delta={sessions - sessionsBefore}
          digits={0}
        />
        <StatTile
          label={t('sleep.avgDuration')}
          value={duration(sleepNow)}
          hint={t('metrics.perDay')}
          delta={sleepNow != null && sleepBefore != null ? (sleepNow - sleepBefore) / 60 : null}
          deltaUnit=" h"
        />
        <StatTile
          label={`Ø ${t('nutrition.calories')}`}
          value={kcalNow != null ? num(kcalNow) : '–'}
          hint={t('metrics.perDay')}
          delta={kcalNow != null && kcalBefore != null ? kcalNow - kcalBefore : null}
          deltaUnit=" kcal"
          digits={0}
          neutral
        />
        <StatTile
          label={`Ø ${t('activity.steps')}`}
          value={stepsNow != null ? num(stepsNow) : '–'}
          hint={t('metrics.perDay')}
          delta={stepsNow != null && stepsBefore != null ? stepsNow - stepsBefore : null}
          digits={0}
        />
        <div className="col-span-2">
          <StatTile
            label={t('metrics.body.trendWeight')}
            value={weightNow != null ? `${num(weightNow, 1)} kg` : '–'}
            hint={t('metrics.overPeriod')}
            delta={weightNow != null && weightBefore != null ? weightNow - weightBefore : null}
            deltaUnit=" kg"
            digits={2}
            lowerIsBetter
          />
        </div>
        {hasMacros && (
          <div className="col-span-2 rounded-control bg-raised p-3">
            <p className="mb-2 text-meta text-ink-mute">
              {t('metrics.macrosAvg')} <span className="text-ink-faint">{t('metrics.perDay')}</span>
            </p>
            {/* Shares by calories, not by grams — the split is what the tile is
                for, and the grams stand next to it. */}
            <MacroSplit proteinG={proteinNow ?? 0} carbsG={carbsNow ?? 0} fatG={fatNow ?? 0} />
          </div>
        )}
      </div>

      <p className="text-label text-ink-faint">{t('metrics.comparedWithBefore')}</p>

      {/* The way in to the week's review. It is a screen of its own rather than
          a seventh tab: it is read once a week, not switched between. */}
      <Link
        to="/week"
        className="flex items-center gap-2 rounded-control bg-raised px-3 py-2.5 text-meta font-medium text-accent hover:bg-line"
      >
        <CalendarDays size={15} className="shrink-0" />
        {t('review.title')}
        <ChevronRight size={15} className="ml-auto shrink-0 text-ink-faint" />
      </Link>
    </Block>
  )
}
