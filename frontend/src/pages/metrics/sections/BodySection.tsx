import { Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chart } from '../../../components/charts/Chart'
import { StatTile } from '../../../components/charts/StatTile'
import { useAuth } from '../../../app/auth/AuthProvider'
import { useWeight } from '../../../features/weight/hooks'
import { useNutrition } from '../../../features/nutrition/hooks'
import { moduleColor } from '../../../lib/modules'
import { defined, latest, mean, movingAverage, slopePerDay } from '../../../lib/stats'
import { Block, EmptyHint } from '../Block'
import { num, series } from '../shared'

/** A kilogram of body mass is roughly this many kilocalories of stored energy. */
const KCAL_PER_KG = 7700

export function BodySection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: weight = [] } = useWeight(days)
  const { data: nutrition = [] } = useNutrition(days)

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
  // two weeks of both.
  const kcalMean = mean(defined(kcalPoints))
  const kcalDays = defined(kcalPoints).length
  const tdee =
    kcalMean != null && ratePerWeek != null && kcalDays >= 14 && readings.length >= 8
      ? kcalMean - (ratePerWeek / 7) * KCAL_PER_KG
      : null

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

      <Block module="body" icon={<Scale size={15} />} title={t('metrics.body.tdee')}>
        <StatTile
          label={t('metrics.body.tdee')}
          value={tdee != null ? `${num(tdee)} kcal` : '–'}
          hint={tdee != null ? t('metrics.body.tdeeHint') : t('metrics.body.tdeeNeeds')}
        />
        {tdee != null && (
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
