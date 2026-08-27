import { Activity, Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatTile } from '../../../components/charts/StatTile'
import { Chart } from '../../../components/charts/Chart'
import { PeriodTabs } from '../../../components/ui/PeriodTabs'
import { useActivity } from '../../../features/activity/hooks'
import { useNutrition } from '../../../features/nutrition/hooks'
import { useSleep } from '../../../features/sleep/hooks'
import { useWeight } from '../../../features/weight/hooks'
import { useWorkouts } from '../../../features/workouts/hooks'
import { useAuth } from '../../../app/auth/AuthProvider'
import { moduleColor } from '../../../lib/modules'
import { periodRange, usePeriod } from '../../../lib/period'
import { defined, latest, mean, movingAverage } from '../../../lib/stats'
import { Block } from '../Block'
import { duration, num, series, seriesBetween } from '../shared'
import { dateLocale } from '../../../i18n'

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
}

/**
 * The four numbers that get looked at daily, totalled over a period the reader
 * chooses, plus the weight trend over the range set in the header.
 *
 * The two switches are deliberately separate. Counting sessions over a trailing
 * seven days answers a question nobody asked — a Wednesday reaches back into
 * last week and reports five for a week that had three — so the counts run on
 * calendar periods. The weight line has no such boundary and keeps the range.
 */
export function OverviewSection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [period, setPeriod] = usePeriod('metrics.overview')

  const range = periodRange(period)
  // One request wide enough for the period and the stretch it is compared
  // against, and one for the weight chart, which follows the header instead.
  const history = Math.max(range.days, days)

  const { data: workouts = [] } = useWorkouts(history)
  const { data: sleep = [] } = useSleep(history)
  const { data: nutrition = [] } = useNutrition(history)
  const { data: activity = [] } = useActivity(history)
  const { data: weight = [] } = useWeight(Math.max(days, 30))

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

  // The sparklines show the shape of the period itself, not of the window
  // behind it, so they start where the period starts.
  const sessionsByDay = new Map<string, number>()
  for (const w of workouts) sessionsByDay.set(w.date, (sessionsByDay.get(w.date) ?? 0) + 1)
  const sessionSpark = seriesBetween(
    [...sessionsByDay].map(([date, value]) => ({ date, value })),
    r => r.value,
    range.from,
    range.to,
  )
  const sleepSpark = seriesBetween(sleep, e => e.actualSleepMinutes ?? e.timeInBedMinutes, range.from, range.to)
  const kcalSpark = seriesBetween(nutrition, e => e.kcal, range.from, range.to)
  const stepSpark = seriesBetween(activity, e => e.steps, range.from, range.to)

  // "24. Aug. – 27. Aug.", so the tiles say which days they counted.
  const spanLabel = `${formatDay(range.from)} – ${formatDay(range.to)}`

  const weightPoints = series(weight, e => e.weightKg, days)
  const weightTrend = latest(movingAverage(weightPoints, 7, 3))

  const nothing =
    workouts.length === 0 && sleep.length === 0 && nutrition.length === 0 &&
    activity.length === 0 && weight.length === 0

  if (nothing) {
    return (
      <Block module="train" icon={<Activity size={15} />} title={t('metrics.tabs.overview')}>
        <p className="py-8 text-center text-body text-ink-mute">{t('metrics.empty')}</p>
      </Block>
    )
  }

  return (
    <>
      <Block
        module="train"
        icon={<Activity size={15} />}
        title={t(`metrics.periods.${period}`)}
        summary={spanLabel}
      >
        <PeriodTabs value={period} onChange={setPeriod} />

        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('nav.workouts')}
            value={num(sessions)}
            hint={t('metrics.periodTotal')}
            delta={sessions - sessionsBefore}
            digits={0}
            spark={sessionSpark}
            color={moduleColor.train}
          />
          <StatTile
            label={t('sleep.avgDuration')}
            value={duration(sleepNow)}
            hint={t('metrics.perDay')}
            delta={sleepNow != null && sleepBefore != null ? (sleepNow - sleepBefore) / 60 : null}
            deltaUnit=" h"
            spark={sleepSpark}
            color={moduleColor.sleep}
            smooth={7}
          />
          <StatTile
            label={t('nutrition.calories')}
            value={kcalNow != null ? num(kcalNow) : '–'}
            hint={t('metrics.perDay')}
            delta={kcalNow != null && kcalBefore != null ? kcalNow - kcalBefore : null}
            deltaUnit=" kcal"
            digits={0}
            neutral
            spark={kcalSpark}
            color={moduleColor.food}
            smooth={7}
          />
          <StatTile
            label={t('activity.steps')}
            value={stepsNow != null ? num(stepsNow) : '–'}
            hint={t('metrics.perDay')}
            delta={stepsNow != null && stepsBefore != null ? stepsNow - stepsBefore : null}
            digits={0}
            spark={stepSpark}
            color={moduleColor.move}
            smooth={7}
          />
        </div>

        <p className="text-label text-ink-faint">{t('metrics.comparedWithBefore')}</p>
      </Block>

      {defined(weightPoints).length > 0 && (
        <Block
          module="body"
          icon={<Scale size={15} />}
          title={t('weight.title')}
          summary={weightTrend != null ? `${num(weightTrend, 1)} kg` : undefined}
        >
          <Chart
            series={[{ label: t('weight.weightKg'), color: moduleColor.body, points: weightPoints, unit: ' kg', averageOver: 7 }]}
            goal={user?.weightGoalKg != null ? { value: user.weightGoalKg, label: t('metrics.goal') } : undefined}
            format={v => num(v, 1)}
          />
        </Block>
      )}
    </>
  )
}
