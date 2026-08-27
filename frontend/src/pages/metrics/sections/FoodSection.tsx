import { Apple, Droplet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chart } from '../../../components/charts/Chart'
import { StatTile } from '../../../components/charts/StatTile'
import { MacroSplit } from '../../../components/charts/MacroSplit'
import { useAuth } from '../../../app/auth/AuthProvider'
import { useNutrition } from '../../../features/nutrition/hooks'
import { useWeight } from '../../../features/weight/hooks'
import { moduleColor } from '../../../lib/modules'
import { adherence, defined, latest, mean, movingAverage } from '../../../lib/stats'
import { Block, EmptyHint } from '../Block'
import { num, perWeekIfDense, series, splitWindow } from '../shared'

export function FoodSection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { data: nutrition = [] } = useNutrition(days)
  const { data: weight = [] } = useWeight(days)

  const kcal = series(nutrition, e => e.kcal, days)
  const protein = series(nutrition, e => e.proteinG, days)
  const carbs = series(nutrition, e => e.carbsG, days)
  const fat = series(nutrition, e => e.fatG, days)
  const water = series(nutrition, e => e.waterL, days)
  const weightPoints = series(weight, e => e.weightKg, days)

  if (defined(kcal).length === 0 && defined(protein).length === 0) {
    return (
      <Block module="food" icon={<Apple size={17} />} title={t('nutrition.title')}>
        <EmptyHint text={t('metrics.empty')} />
      </Block>
    )
  }

  const kcalGoal = user?.kcalGoal ?? null
  const proteinGoal = user?.proteinGoal ?? null

  // The seven-day average is the number a calorie decision is made on. A single
  // day is a meal that ran long, not a direction.
  const rolling = movingAverage(kcal, 7, 3)
  const rollingNow = latest(rolling)

  const { current, previous } = splitWindow(kcal, 7)
  const kcalNow = mean(defined(current))
  const kcalBefore = mean(defined(previous))

  const hits = kcalGoal != null ? adherence(kcal, kcalGoal) : null
  const waterBars = perWeekIfDense(water, 'mean')

  const bodyWeight = latest(movingAverage(weightPoints, 7, 1))
  const proteinMean = mean(defined(protein))
  const proteinPerKg = proteinMean != null && bodyWeight ? proteinMean / bodyWeight : null

  return (
    <>
      <Block module="food" icon={<Apple size={17} />} title={t('metrics.food.calories')}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            // The unit rides in the label: four digits plus "kcal" is wider
            // than half a phone, and the label has room to spare.
            label={`kcal · ${t('metrics.food.rolling')}`}
            value={rollingNow != null ? num(rollingNow) : '–'}
            delta={kcalNow != null && kcalBefore != null ? kcalNow - kcalBefore : null}
            deltaUnit=" kcal"
            digits={0}
            neutral
          />
          <StatTile
            label={t('metrics.food.adherence')}
            value={hits ? `${Math.round(hits.rate * 100)} %` : '–'}
            hint={hits ? t('metrics.food.adherenceHint', { hit: hits.hit, total: hits.total }) : t('metrics.noGoal')}
          />
        </div>

        <Chart
          series={[{ label: t('nutrition.calories'), color: moduleColor.food, points: kcal, unit: ' kcal', averageOver: 7 }]}
          goal={kcalGoal != null ? { value: kcalGoal, label: t('metrics.goal'), tolerance: 0.1 } : undefined}
          format={v => num(v)}
          empty={t('metrics.empty')}
        />
      </Block>

      <Block module="food" icon={<Apple size={17} />} title={t('metrics.food.macroSplit')}>
        <MacroSplit
          proteinG={mean(defined(protein)) ?? 0}
          carbsG={mean(defined(carbs)) ?? 0}
          fatG={mean(defined(fat)) ?? 0}
        />
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('nutrition.protein')}
            value={proteinMean != null ? `${num(proteinMean)} g` : '–'}
            hint={
              proteinGoal != null
                ? t('goals.of', { goal: `${num(proteinGoal)} g` })
                : t('metrics.perDay')
            }
          />
          <StatTile
            label={t('metrics.food.proteinPerKg')}
            value={proteinPerKg != null ? `${num(proteinPerKg, 2)} g/kg` : '–'}
            hint={t('metrics.perDay')}
          />
        </div>
      </Block>

      {defined(weightPoints).length >= 4 && defined(kcal).length >= 7 && (
        <Block module="food" icon={<Apple size={17} />} title={t('metrics.food.caloriesVsWeight')}>
          <Chart
            series={[
              { label: t('nutrition.calories'), color: moduleColor.food, points: kcal, unit: ' kcal', averageOver: 7 },
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
        </Block>
      )}

      {defined(water).length > 0 && (
        <Block
          module="food"
          icon={<Droplet size={17} />}
          title={t('nutrition.water')}
          summary={waterBars.weekly ? t('metrics.weekly') : undefined}
        >
          <Chart
            series={[{ label: t('nutrition.water'), color: moduleColor.move, points: waterBars.points, kind: 'bar', unit: ' L' }]}
            goal={user?.waterGoalL != null ? { value: user.waterGoalL, label: t('metrics.goal') } : undefined}
            zeroBased
            format={v => num(v, 1)}
          />
        </Block>
      )}
    </>
  )
}
