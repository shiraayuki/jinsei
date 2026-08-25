import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatTile } from '../../../components/charts/StatTile'
import { Chart } from '../../../components/charts/Chart'
import { useActivity } from '../../../features/activity/hooks'
import { useNutrition } from '../../../features/nutrition/hooks'
import { useSleep } from '../../../features/sleep/hooks'
import { useWeight } from '../../../features/weight/hooks'
import { useWorkouts } from '../../../features/workouts/hooks'
import { useAuth } from '../../../app/auth/AuthProvider'
import { moduleColor } from '../../../lib/modules'
import { defined, latest, mean, movingAverage } from '../../../lib/stats'
import { Block } from '../Block'
import { duration, num, series, splitWindow } from '../shared'
import { CorrelationsSection } from './CorrelationsSection'

/**
 * The week against the week before it, for the four numbers that get looked at
 * daily. Everything deeper lives behind its own tab — this is the page you open
 * to find out whether anything needs opening.
 */
export function OverviewSection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: workouts = [] } = useWorkouts(days)
  const { data: sleep = [] } = useSleep(days)
  const { data: nutrition = [] } = useNutrition(days)
  const { data: activity = [] } = useActivity(days)
  const { data: weight = [] } = useWeight(days)

  const sleepMinutes = series(sleep, e => e.actualSleepMinutes ?? e.timeInBedMinutes, days)
  const kcal = series(nutrition, e => e.kcal, days)
  const steps = series(activity, e => e.steps, days)
  const weightPoints = series(weight, e => e.weightKg, days)

  // Sessions per day rather than a count, so the same window logic covers it.
  const sessionsByDay = new Map<string, number>()
  for (const w of workouts) sessionsByDay.set(w.date, (sessionsByDay.get(w.date) ?? 0) + 1)
  const sessions = sleepMinutes.map(p => ({ date: p.date, value: sessionsByDay.get(p.date) ?? 0 }))

  const week = <T,>(points: { date: string; value: number | null }[], fn: (values: number[]) => T) => {
    const { current, previous } = splitWindow(points, 7)
    return { now: fn(defined(current)), before: fn(defined(previous)) }
  }

  const sessionWeek = week(sessions, v => v.reduce((s, n) => s + n, 0))
  const sleepWeek = week(sleepMinutes, mean)
  const kcalWeek = week(kcal, mean)
  const stepWeek = week(steps, mean)

  const weightTrend = latest(movingAverage(weightPoints, 7, 3))

  const nothing =
    workouts.length === 0 && sleep.length === 0 && nutrition.length === 0 &&
    activity.length === 0 && weight.length === 0

  if (nothing) {
    return (
      <Block module="train" icon={<Activity size={15} />} title={t('metrics.thisWeek')}>
        <p className="py-8 text-center text-body text-ink-mute">{t('metrics.empty')}</p>
      </Block>
    )
  }

  return (
    <>
      <Block module="train" icon={<Activity size={15} />} title={t('metrics.thisWeek')}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('nav.workouts')}
            value={num(sessionWeek.now)}
            hint={t('metrics.perWeek')}
            delta={sessionWeek.now - sessionWeek.before}
            spark={sessions}
            color={moduleColor.train}
          />
          <StatTile
            label={t('sleep.avgDuration')}
            value={duration(sleepWeek.now)}
            delta={sleepWeek.now != null && sleepWeek.before != null ? (sleepWeek.now - sleepWeek.before) / 60 : null}
            deltaUnit=" h"
            spark={sleepMinutes}
            color={moduleColor.sleep}
            smooth={7}
          />
          <StatTile
            label={t('nutrition.calories')}
            value={kcalWeek.now != null ? num(kcalWeek.now) : '–'}
            hint={t('metrics.perDay')}
            delta={kcalWeek.now != null && kcalWeek.before != null ? kcalWeek.now - kcalWeek.before : null}
            deltaUnit=" kcal"
            neutral
            spark={kcal}
            color={moduleColor.food}
            smooth={7}
          />
          <StatTile
            label={t('activity.steps')}
            value={stepWeek.now != null ? num(stepWeek.now) : '–'}
            hint={t('metrics.perDay')}
            delta={stepWeek.now != null && stepWeek.before != null ? stepWeek.now - stepWeek.before : null}
            digits={0}
            spark={steps}
            color={moduleColor.move}
            smooth={7}
          />
        </div>
      </Block>

      {defined(weightPoints).length > 0 && (
        <Block
          module="body"
          icon={<Activity size={15} />}
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

      <CorrelationsSection days={days} />
    </>
  )
}
