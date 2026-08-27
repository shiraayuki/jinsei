import { useState } from 'react'
import { AlertTriangle, Dumbbell, Footprints, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chart } from '../../../components/charts/Chart'
import { StatTile } from '../../../components/charts/StatTile'
import { BarRow } from '../../../components/charts/BarRow'
import { Sparkline } from '../../../components/charts/Sparkline'
import { useAuth } from '../../../app/auth/AuthProvider'
import { useWorkoutAnalytics } from '../../../features/workouts/hooks'
import { useActivity } from '../../../features/activity/hooks'
import type { ExerciseProgress } from '../../../features/workouts/api'
import { moduleColor } from '../../../lib/modules'
import { defined, mean } from '../../../lib/stats'
import { Block, EmptyHint } from '../Block'
import { num, perWeekIfDense, series } from '../shared'

/** How many exercises the list shows before it has to be asked for the rest. */
const VISIBLE_EXERCISES = 6

/** Hevy's muscle group ids, which are English slugs, rendered per language. */
function groupLabel(group: string, t: (key: string) => string): string {
  const key = `muscles.${group}`
  const translated = t(key)
  return translated === key ? group : translated
}

export function TrainingSection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data, isLoading } = useWorkoutAnalytics(days)
  const { data: activity = [] } = useActivity(days)
  const [showAll, setShowAll] = useState(false)

  const steps = series(activity, e => e.steps, days)
  const stepBars = perWeekIfDense(steps, 'mean')

  if (isLoading) return <EmptyHint text={t('common.loading')} />
  if (!data || data.totals.sessions === 0) {
    return (
      <Block module="train" icon={<Dumbbell size={17} />} title={t('nav.workouts')}>
        <EmptyHint text={t('workouts.empty')} />
      </Block>
    )
  }

  const weeks = data.weekly
  // The current week is still being written, so it is not what a change is
  // measured against.
  const closed = weeks.slice(0, -1)
  const lastFour = closed.slice(-4)
  const priorFour = closed.slice(-8, -4)

  const setsPoints = weeks.map(w => ({ date: w.weekStart, value: w.sets }))
  const volumePoints = weeks.map(w => ({ date: w.weekStart, value: w.volumeKg }))
  const sessionsPerWeek = mean(lastFour.map(w => w.sessions))
  const priorSessionsPerWeek = mean(priorFour.map(w => w.sessions))
  const setsPerWeek = mean(lastFour.map(w => w.sets))
  const priorSetsPerWeek = mean(priorFour.map(w => w.sets))

  const groupMax = Math.max(...data.muscleGroups.map(g => g.sets), 1)
  const exercises = showAll ? data.exercises : data.exercises.slice(0, VISIBLE_EXERCISES)
  const stalled = data.exercises.filter(e => e.stagnant)

  return (
    <>
      <Block module="train" icon={<Dumbbell size={17} />} title={t('nav.workouts')}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('metrics.training.frequency')}
            value={sessionsPerWeek != null ? num(sessionsPerWeek, 1) : '–'}
            hint={t('metrics.training.frequencyHint')}
            delta={sessionsPerWeek != null && priorSessionsPerWeek != null ? sessionsPerWeek - priorSessionsPerWeek : null}
          />
          <StatTile
            label={t('metrics.training.weeklySets')}
            value={setsPerWeek != null ? num(setsPerWeek) : '–'}
            hint={
              user?.weeklySetsGoal != null
                ? t('goals.of', { goal: num(user.weeklySetsGoal) })
                : t('metrics.perWeek')
            }
            delta={setsPerWeek != null && priorSetsPerWeek != null ? setsPerWeek - priorSetsPerWeek : null}
          />
        </div>

        <Chart
          series={[{ label: t('metrics.training.weeklySets'), color: moduleColor.train, points: setsPoints, kind: 'bar' }]}
          goal={user?.weeklySetsGoal != null ? { value: user.weeklySetsGoal, label: t('metrics.goal') } : undefined}
          zeroBased
          format={v => num(v)}
        />
      </Block>

      <Block module="train" icon={<TrendingUp size={17} />} title={t('metrics.training.weeklyVolume')}>
        <Chart
          series={[{ label: t('metrics.volume'), color: moduleColor.train, points: volumePoints, kind: 'bar', unit: ' kg' }]}
          zeroBased
          format={v => (v >= 1000 ? `${num(v / 1000, 1)} t` : num(v))}
        />
      </Block>

      {data.muscleGroups.length > 0 && (
        <Block module="train" icon={<Dumbbell size={17} />} title={t('metrics.training.muscleGroups')}>
          <div className="space-y-1.5">
            {data.muscleGroups.map(g => {
              const change = g.sets - g.previousSets
              return (
                <BarRow
                  key={g.group}
                  label={groupLabel(g.group, t)}
                  value={g.sets}
                  max={groupMax}
                  color={moduleColor.train}
                  hint={`${t('metrics.training.perWeekShort', { value: num(g.setsPerWeek, 1) })} ${change > 0 ? '↑' : change < 0 ? '↓' : '='}`}
                  tone={change > 0 ? 'good' : change < 0 ? 'bad' : 'mute'}
                />
              )
            })}
          </div>
          <p className="text-label text-ink-faint">{t('metrics.training.muscleHint')}</p>
        </Block>
      )}

      <Block
        module="train"
        icon={<TrendingUp size={17} />}
        title={t('metrics.training.progression')}
        summary={stalled.length > 0 ? `${stalled.length} × ${t('metrics.training.stagnant')}` : undefined}
      >
        <div className="space-y-2">
          {exercises.map(ex => (
            <ExerciseRow key={ex.name} exercise={ex} />
          ))}
        </div>
        {data.exercises.length > VISIBLE_EXERCISES && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full rounded-control bg-raised py-2 text-meta font-medium text-ink-soft hover:bg-line transition-colors"
          >
            {showAll ? t('metrics.training.showLess') : t('metrics.training.showAll', { count: data.exercises.length })}
          </button>
        )}
      </Block>

      {defined(steps).length > 0 && (
        <Block
          module="move"
          icon={<Footprints size={17} />}
          title={t('activity.steps')}
          summary={stepBars.weekly ? t('metrics.weekly') : undefined}
        >
          <Chart
            series={[{ label: t('activity.steps'), color: moduleColor.move, points: stepBars.points, kind: 'bar' }]}
            goal={user?.stepsGoal != null ? { value: user.stepsGoal, label: t('metrics.goal') } : undefined}
            zeroBased
            format={v => num(v)}
          />
        </Block>
      )}
    </>
  )
}

/**
 * One lift: what it is doing, and the estimated max it is doing it with. The
 * sparkline carries the shape and the badge carries the verdict, so the row
 * answers "does this need changing" without being read in full.
 */
function ExerciseRow({ exercise }: { exercise: ExerciseProgress }) {
  const { t } = useTranslation()
  const history = exercise.history.map(h => ({ date: h.date, value: h.estimatedOneRepMax }))
  const last = exercise.history[exercise.history.length - 1]

  return (
    <div className="rounded-control bg-raised p-3">
      <div className="flex items-baseline gap-2">
        <p className="min-w-0 flex-1 truncate text-body font-medium text-ink">{exercise.name}</p>
        {exercise.stagnant ? (
          <span className="flex shrink-0 items-center gap-1 rounded-chip bg-warn/12 px-1.5 py-0.5 text-label font-medium text-warn">
            <AlertTriangle size={10} /> {t('metrics.training.stagnant')}
          </span>
        ) : exercise.changePercent != null && exercise.changePercent > 0 ? (
          <span className="shrink-0 text-label font-medium text-good tabular">
            +{num(exercise.changePercent, 1)} %
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-meta text-ink-soft tabular">
            {exercise.latestOneRepMax != null
              ? `${t('metrics.training.estimatedMax')} ${num(exercise.latestOneRepMax, 1)} kg`
              : t('metrics.training.noEstimate')}
          </p>
          <p className="truncate text-label text-ink-faint tabular">
            {last?.topSetWeightKg != null && last.topSetReps != null
              ? `${t('metrics.training.topSet', { weight: num(last.topSetWeightKg, 1), reps: last.topSetReps })} · `
              : ''}
            {t('metrics.training.daysSince', { count: exercise.daysSince })} · {exercise.sessions} ×
          </p>
        </div>
        <Sparkline points={history} color={moduleColor.train} width={72} height={24} />
      </div>
    </div>
  )
}
