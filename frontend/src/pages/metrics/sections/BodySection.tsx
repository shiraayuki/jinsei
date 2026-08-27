import { Flame, Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chart } from '../../../components/charts/Chart'
import { StatTile } from '../../../components/charts/StatTile'
import { useAuth } from '../../../app/auth/AuthProvider'
import { useWeight } from '../../../features/weight/hooks'
import { useNutrition } from '../../../features/nutrition/hooks'
import { moduleColor } from '../../../lib/modules'
import { defined, latest, movingAverage, slopePerDay } from '../../../lib/stats'
import { KCAL_PER_KG, weeklyChangeFor } from '../../../lib/energy'
import { useApplyEnergyTarget, useEnergyTarget } from '../../../features/energy/hooks'
import { Block, EmptyHint } from '../Block'
import { num, series } from '../shared'

/** How close the estimate is to being able to answer at all. */
function Progress({ label, have, need, missing }: { label: string; have: number; need: number; missing: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-baseline gap-2">
      <span className="min-w-0 flex-1 truncate text-meta text-ink-soft">{label}</span>
      <span className="shrink-0 text-meta tabular text-ink-mute">
        {have}/{need}
      </span>
      <span className={`shrink-0 text-label tabular ${missing === 0 ? 'text-good' : 'text-ink-faint'}`}>
        {missing === 0 ? '✓' : t('metrics.body.stillNeeded', { count: missing })}
      </span>
    </div>
  )
}

export function BodySection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  const { data: weight = [] } = useWeight(days)
  const { data: nutrition = [] } = useNutrition(days)
  // The energy block is the one part of this page that does not follow the
  // range switch: it is a fixed four-week window, worked out on the server, so
  // the figure shown is the figure the Monday job would write.
  const { data: energy } = useEnergyTarget()
  const apply = useApplyEnergyTarget()

  const weightPoints = series(weight, e => e.weightKg, days)
  const waistPoints = series(weight, e => e.waistCm, days)
  const kcalPoints = series(nutrition, e => e.kcal, days)

  const readings = defined(weightPoints)
  if (readings.length === 0) {
    return (
      <Block module="body" icon={<Scale size={17} />} title={t('weight.title')}>
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

  // Nothing modelled: intake against what the scale actually did, which
  // carries every cost there is — including the ones no formula has a term
  // for. The price is patience, which is what the counters below are for.
  const tdee = energy?.tdee ?? null
  const kcalMean = energy?.meanKcal ?? null
  const kcalDays = energy?.kcalDays ?? 0
  const weighIns = energy?.weighIns ?? 0
  const kcalMissing = Math.max(0, (energy?.minKcalDays ?? 0) - kcalDays)
  const weighMissing = Math.max(0, (energy?.minWeighIns ?? 0) - weighIns)

  // What the current intake does against that need, and what it works out to
  // on the scale.
  const balance = tdee != null && kcalMean != null ? kcalMean - tdee : null
  const balanceRate = balance != null ? weeklyChangeFor(balance) : null

  // The week's target: the chosen pace applied to the weight the week started
  // at, subtracted from what maintenance turned out to be.
  const rate = energy?.ratePercent ?? null
  const anchor = energy?.anchorWeightKg ?? null
  const weeklyKg = energy?.weeklyKg ?? null
  const weekTarget = energy?.targetKcal ?? null
  const adopted = energy?.adopted ?? false

  async function adoptTarget() {
    await apply.mutateAsync()
    // The goal is a line in half the charts and lives on the user, which is
    // context rather than a query.
    await refresh()
  }
  const cutKcal = tdee != null ? tdee - (0.5 * KCAL_PER_KG) / 7 : null

  return (
    <>
      <Block module="body" icon={<Scale size={17} />} title={t('weight.title')}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('weight.weightKg')}
            value={trendNow != null ? `${num(trendNow, 1)} kg` : num(latest(weightPoints), 1)}
            hint={t('metrics.trend')}
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
        icon={<Flame size={17} />}
        title={t('metrics.body.tdee')}
        summary={tdee != null ? t('metrics.body.measured') : undefined}
      >
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={`kcal · ${t('metrics.body.tdee')}`}
            value={tdee != null ? num(tdee) : '–'}
            hint={
              tdee != null
                ? t('metrics.body.tdeeHint', { days: energy?.windowDays ?? 0 })
                : t('metrics.body.tdeeNeeds')
            }
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
            label={`kcal · ${t('metrics.body.cutTarget', { rate: num(0.5, 1) })}`}
            value={cutKcal != null ? num(cutKcal) : '–'}
            hint={t('metrics.perDay')}
          />
        </div>

        {/* The target only exists once maintenance does; before that the
            counters below explain why. */}
        {weekTarget != null && weeklyKg != null && rate != null && (
          <div className="space-y-2 rounded-control bg-raised p-3">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-meta text-ink-soft">
                {t('metrics.body.weekTarget')}
              </span>
              <span className="shrink-0 font-display text-value font-semibold text-ink tabular">
                {num(weekTarget)}
              </span>
              <span className="shrink-0 text-meta text-ink-mute">kcal</span>
            </div>
            <p className="text-label text-ink-faint">
              {t('metrics.body.weekTargetHint', { rate: num(rate, 2), kg: num(weeklyKg, 2) })}
              {anchor != null && ` · ${t('metrics.body.anchorWeight', { value: num(anchor, 1) })}`}
            </p>
            <button
              onClick={adoptTarget}
              disabled={apply.isPending || adopted}
              className={`w-full rounded-chip py-2 text-meta font-medium transition-colors ${
                adopted ? 'bg-good/12 text-good' : 'bg-line text-ink hover:bg-line-strong'
              }`}
            >
              {adopted ? t('metrics.body.targetAdopted') : t('metrics.body.adoptTarget')}
            </button>
          </div>
        )}

        {tdee != null && rate == null && (
          <p className="text-label text-ink-faint">{t('metrics.body.noRate')}</p>
        )}

        {/* Until it can answer, the card says how far off the answer is —
            two counters beat a dash that never explains itself. */}
        {tdee == null && energy != null && (
          <div className="space-y-1.5 rounded-control bg-raised p-3">
            <Progress
              label={t('nutrition.calories')}
              have={kcalDays}
              need={energy.minKcalDays}
              missing={kcalMissing}
            />
            <Progress
              label={t('weight.title')}
              have={weighIns}
              need={energy.minWeighIns}
              missing={weighMissing}
            />
          </div>
        )}

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
        <Block module="body" icon={<Scale size={17} />} title={t('metrics.body.waist')}>
          <Chart
            series={[{ label: t('weight.waistCm'), color: moduleColor.mind, points: waistPoints, unit: ' cm', averageOver: 3 }]}
            format={v => num(v, 1)}
          />
        </Block>
      )}
    </>
  )
}
