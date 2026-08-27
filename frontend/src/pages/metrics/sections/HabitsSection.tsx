import { CheckSquare, Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chart } from '../../../components/charts/Chart'
import { StatTile } from '../../../components/charts/StatTile'
import { BarRow } from '../../../components/charts/BarRow'
import { useHabitOverview, useHabits } from '../../../features/habits/hooks'
import { moduleColor } from '../../../lib/modules'
import { mean } from '../../../lib/stats'
import { Block, EmptyHint } from '../Block'
import { num, perWeekIfDense, splitWindow } from '../shared'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function HabitsSection({ days }: { days: number }) {
  const { t } = useTranslation()
  const { data: habits = [] } = useHabits()
  const { data: overview } = useHabitOverview(days)

  const active = habits.filter(h => !h.archived)
  if (!overview || active.length === 0) {
    return (
      <Block module="mind" icon={<CheckSquare size={17} />} title={t('nav.habits')}>
        <EmptyHint text={t('dashboard.addHabits')} />
      </Block>
    )
  }

  // A day nothing was due is not a day that was missed, so it stays out of the
  // series rather than counting as zero.
  const rate = overview.daily.map(d => ({
    date: d.date,
    value: d.due > 0 ? (d.done / d.due) * 100 : null,
  }))
  const bars = perWeekIfDense(rate, 'mean')

  const { current, previous } = splitWindow(rate, 7)
  const nowRate = mean(current.map(p => p.value).filter((v): v is number => v != null))
  const beforeRate = mean(previous.map(p => p.value).filter((v): v is number => v != null))

  const bestStreak = active.reduce((best, h) => Math.max(best, h.streak), 0)
  const doneToday = active.filter(h => h.completedToday).length

  return (
    <>
      <Block module="mind" icon={<CheckSquare size={17} />} title={t('metrics.habits.daily')}>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('metrics.habits.completion')}
            value={`${num(overview.completionPercent)} %`}
            hint={t('metrics.habits.completionHint')}
            delta={nowRate != null && beforeRate != null ? nowRate - beforeRate : null}
            deltaUnit=" %"
          />
          <StatTile
            label={t('metrics.todayDone')}
            value={`${doneToday}/${active.length}`}
            hint={t('metrics.bestStreak') + `: ${bestStreak}`}
          />
        </div>

        <Chart
          series={[{ label: t('metrics.habits.completion'), color: moduleColor.mind, points: bars.points, kind: 'bar', unit: ' %' }]}
          goal={{ value: 100, label: '100 %' }}
          zeroBased
          format={v => num(v)}
        />
      </Block>

      <Block module="mind" icon={<CheckSquare size={17} />} title={t('metrics.habits.byWeekday')}>
        <div className="space-y-1.5">
          {overview.weekdayRates.map((value, i) => (
            <BarRow
              key={WEEKDAYS[i]}
              label={WEEKDAYS[i]}
              value={value}
              max={100}
              color={moduleColor.mind}
              hint={`${num(value)} %`}
            />
          ))}
        </div>
      </Block>

      <Block module="mind" icon={<Flame size={17} />} title={t('metrics.habits.openStreaks')}>
        <div className="space-y-1.5">
          {[...active]
            .sort((a, b) => b.streak - a.streak)
            .map(h => (
              <BarRow
                key={h.id}
                label={h.name}
                value={h.streak}
                max={Math.max(bestStreak, 1)}
                color={h.color}
                hint={`${h.streak} d`}
              />
            ))}
        </div>
      </Block>
    </>
  )
}
