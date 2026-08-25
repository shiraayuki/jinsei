import { Flame, Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chart } from '../../../components/charts/Chart'
import { StatTile } from '../../../components/charts/StatTile'
import { useAuth } from '../../../app/auth/AuthProvider'
import { useWeight } from '../../../features/weight/hooks'
import { useNutrition } from '../../../features/nutrition/hooks'
import { useActivity } from '../../../features/activity/hooks'
import { useWorkoutAnalytics } from '../../../features/workouts/hooks'
import { moduleColor } from '../../../lib/modules'
import { defined, latest, mean, movingAverage, slopePerDay } from '../../../lib/stats'
import { KCAL_PER_KG } from '../../../lib/energy'
import { derivedTdee, measuredTdee, weeklyChangeFor } from '../../../lib/energy'
import { Block, EmptyHint } from '../Block'
import { num, series } from '../shared'

/** One line of the breakdown: what it is, what it costs, and where it came from. */
function Row({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`min-w-0 flex-1 truncate text-meta ${strong ? 'font-medium text-ink' : 'text-ink-soft'}`}>
        {label}
        {note && <span className="ml-1 text-label text-ink-faint">{note}</span>}
      </span>
      <span className={`shrink-0 text-meta tabular ${strong ? 'font-semibold text-ink' : 'text-ink-mute'}`}>
        {value}
      </span>
    </div>
  )
}

export function BodySection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: weight = [] } = useWeight(days)
  const { data: nutrition = [] } = useNutrition(days)
  const { data: activity = [] } = useActivity(days)
  const { data: analytics } = useWorkoutAnalytics(days)

  const weightPoints = series(weight, e => e.weightKg, days)
  const waistPoints = series(weight, e => e.waistCm, days)
  const kcalPoints = series(nutrition, e => e.kcal, days)

  const readings = defined(weightPoints)
  if (readings.length === 0) {
    return (
      <Block module="body" icon={<Scale size={15} />} title={t('weight.title')}>
        <EmptyHint text={t('metrics.empty')} />
      </Block>
    )
  }

  // The trend line, not the last weigh-in, is what the rate is measured on: a
  // salty dinner moves the scale by more than a week of deficit does.
  const trend = movingAverage(weightPoints, 7, 3)
  const trendNow = latest(trend)
  const ratePerWeek = readings.length >= 3 ? (slopePerDay(weightPoints) ?? 0) * 7 : null

  const goal = user?.weightGoalKg ?? null
  const toGoal = goal != null && trendNow != null ? trendNow - goal : null
  const weeksToGoal =
    toGoal != null && ratePerWeek != null && ratePerWeek !== 0 && Math.sign(-toGoal) === Math.sign(ratePerWeek)
      ? Math.abs(toGoal / ratePerWeek)
      : null

  // Maintenance from what actually happened: average intake plus the energy the
  // body took out of, or put into, storage. Beats any formula once there are
  // two weeks of both — until then the formula stands in.
  const kcalMean = mean(defined(kcalPoints))
  const kcalDays = defined(kcalPoints).length
  const measured =
    kcalMean != null && ratePerWeek != null && kcalDays >= 14 && readings.length >= 8
      ? measuredTdee(kcalMean, ratePerWeek)
      : null

  const profile = {
    birthDate: user?.birthDate ?? null,
    heightCm: user?.heightCm ?? null,
    sex: user?.sex ?? null,
    activityLevel: user?.activityLevel ?? null,
  }
  const currentWeight = trendNow ?? latest(weightPoints)

  // What was actually walked and actually trained, rather than a lifestyle
  // picked from a list: the multiplier that asks for both is where every
  // calculator double-counts the gym.
  const stepValues = defined(series(activity, e => e.steps, days))
  const meanSteps = mean(stepValues)

  // The running week is still being written, so it is not what an average is
  // taken over.
  const closedWeeks = (analytics?.weekly ?? []).slice(0, -1).slice(-4)
  const weeklyTrainingMinutes = mean(closedWeeks.map(w => w.durationMinutes))
  const weeklySessions = mean(closedWeeks.map(w => w.sessions))

  const derived =
    currentWeight != null
      ? derivedTdee({ weightKg: currentWeight, profile, meanSteps, weeklyTrainingMinutes })
      : null

  // The measured number wins wherever it exists: it contains every cost the
  // other two only estimate, including the ones nobody models.
  const tdee = measured ?? derived?.total ?? null
  const source = measured != null ? t('metrics.body.measured') : t('metrics.body.derived')

  // What the current intake does against that need, and what it works out to
  // on the scale.
  const balance = tdee != null && kcalMean != null ? kcalMean - tdee : null
  const balanceRate = balance != null ? weeklyChangeFor(balance) : null
  const cutKcal = tdee != null ? tdee - (0.5 * KCAL_PER_KG) / 7 : null

  return (
    <>
      <Block module="body" icon={<Scale size={15} />} title={t('weight.title')}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('weight.weightKg')}
            value={trendNow != null ? `${num(trendNow, 1)} kg` : num(latest(weightPoints), 1)}
            hint={t('metrics.trend')}
            spark={weightPoints}
            color={moduleColor.body}
            smooth={7}
          />
          <StatTile
            label={t('metrics.body.trendRate')}
            value={ratePerWeek != null ? t('metrics.body.ratePerWeek', { value: num(ratePerWeek, 2) }) : '–'}
            hint={
              toGoal != null
                ? t('metrics.body.toGoal', { value: num(Math.abs(toGoal), 1) })
                : t('metrics.noGoal')
            }
          />
        </div>

        <Chart
          series={[
            {
              label: t('weight.weightKg'),
              color: moduleColor.body,
              points: weightPoints,
              unit: ' kg',
              averageOver: 7,
            },
          ]}
          goal={goal != null ? { value: goal, label: t('metrics.goal') } : undefined}
          format={v => num(v, 1)}
          empty={t('metrics.empty')}
        />

        {weeksToGoal != null && (
          <p className="text-label text-ink-faint">
            {t('metrics.body.etaWeeks', { count: Math.round(weeksToGoal) })}
          </p>
        )}
      </Block>

      <Block
        module="body"
        icon={<Flame size={15} />}
        title={t('metrics.body.tdee')}
        summary={tdee != null ? source : undefined}
      >
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={`kcal · ${t('metrics.body.tdee')}`}
            value={tdee != null ? num(tdee) : '–'}
            hint={
              measured != null
                ? t('metrics.body.tdeeHint')
                : derived != null
                  ? t('metrics.body.impliedFactor', { value: num(derived.impliedFactor, 2) })
                  : t('metrics.body.tdeeNeedsBody')
            }
          />
          <StatTile
            label={`kcal · ${t('metrics.body.restingRate')}`}
            value={derived != null ? num(derived.restingKcal) : '–'}
            hint={derived == null ? t('metrics.body.tdeeNeedsBody') : undefined}
          />
          <StatTile
            label={`kcal · ${t('metrics.body.balance')}`}
            value={balance != null ? `${balance > 0 ? '+' : ''}${num(balance)}` : '–'}
            hint={
              balanceRate != null
                ? t('metrics.body.balanceRate', { value: num(balanceRate, 2) })
                : t('metrics.body.tdeeNeeds')
            }
          />
          <StatTile
            label={`kcal · ${t('metrics.body.cutTarget', { rate: '0,5' })}`}
            value={cutKcal != null ? num(cutKcal) : '–'}
            hint={t('metrics.perDay')}
          />
        </div>

        {derived != null && (
          <div className="space-y-1.5 rounded-control bg-raised p-3">
            <p className="text-label font-semibold uppercase tracking-widest text-ink-faint">
              {t('metrics.body.breakdown')}
            </p>
            <Row label={t('metrics.body.restingRate')} value={num(derived.restingKcal)} />
            <Row label={t('metrics.body.job')} value={`+ ${num(derived.jobKcal)}`} />
            <Row
              label={t('metrics.body.steps')}
              value={`+ ${num(derived.stepKcal)}`}
              note={meanSteps != null ? t('metrics.body.stepsPerDay', { value: num(meanSteps) }) : undefined}
            />
            <Row
              label={t('metrics.body.training')}
              value={`+ ${num(derived.trainingKcal)}`}
              note={
                weeklySessions != null && weeklyTrainingMinutes != null
                  ? t('metrics.body.trainingPerWeek', {
                      sessions: num(weeklySessions, 1),
                      minutes: num(weeklyTrainingMinutes),
                    })
                  : undefined
              }
            />
            <div className="border-t border-line pt-1.5">
              <Row label={t('metrics.body.tdee')} value={num(derived.total)} strong />
            </div>
            {(meanSteps == null || weeklyTrainingMinutes == null) && (
              <p className="text-label text-ink-faint">{t('metrics.body.tdeeNeedsSteps')}</p>
            )}
          </div>
        )}

        {measured == null && derived != null && (
          <p className="text-label text-ink-faint">{t('metrics.body.tdeeNeeds')}</p>
        )}

        {measured != null && (
          <Chart
            series={[
              { label: t('nutrition.calories'), color: moduleColor.food, points: kcalPoints, unit: ' kcal', averageOver: 7 },
              {
                label: t('weight.weightKg'),
                color: moduleColor.body,
                points: weightPoints,
                unit: ' kg',
                averageOver: 7,
                scaleWith: 'weight',
              },
            ]}
            format={v => num(v)}
          />
        )}
      </Block>

      {defined(waistPoints).length > 0 && (
        <Block module="body" icon={<Scale size={15} />} title={t('metrics.body.waist')}>
          <Chart
            series={[{ label: t('weight.waistCm'), color: moduleColor.mind, points: waistPoints, unit: ' cm', averageOver: 3 }]}
            format={v => num(v, 1)}
          />
        </Block>
      )}
    </>
  )
}
