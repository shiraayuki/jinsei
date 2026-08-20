import { useMemo, useState } from 'react'
import { Apple, CheckSquare, Dumbbell, Footprints, Moon, Scale, Smile, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/ui/PageHeader'
import { MetricChart } from '../../components/charts/MetricChart'
import { BarSeries } from '../../components/charts/BarSeries'
import { useHabits } from '../../features/habits/hooks'
import { useWorkouts } from '../../features/workouts/hooks'
import { useSleep } from '../../features/sleep/hooks'
import { useWeight } from '../../features/weight/hooks'
import { useNutrition } from '../../features/nutrition/hooks'
import { useActivity } from '../../features/activity/hooks'
import { useWellbeing } from '../../features/wellbeing/hooks'
import { dateLocale } from '../../i18n'
import { toIsoDate } from '../../lib/date'

const RANGES = [7, 30, 90, 180] as const

function getWeekBounds(weeksAgo = 0) {
  const today = new Date()
  const daysBack = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysBack - weeksAgo * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: toIsoDate(monday), end: toIsoDate(sunday) }
}

function inWeek<T extends { date: string }>(items: T[], week: { start: string; end: string }) {
  return items.filter(i => i.date >= week.start && i.date <= week.end)
}

function mean(values: number[]) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return '–'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 dark:bg-zinc-800/60 p-3">
      <p className="truncate text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="truncate text-[11px] text-gray-400 dark:text-zinc-500">{label}</p>
      {hint && <p className="truncate text-[10px] text-gray-400 dark:text-zinc-600">{hint}</p>}
    </div>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Delta({ value, unit = '', lowerIsBetter = false }: { value: number | null; unit?: string; lowerIsBetter?: boolean }) {
  const { t } = useTranslation()
  if (value == null) return null
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500">
        <Minus size={11} /> {t('metrics.vsLastWeek', { delta: '±0', unit })}
      </span>
    )
  }
  const good = lowerIsBetter ? rounded < 0 : rounded > 0
  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${good ? 'text-emerald-400' : 'text-rose-400'}`}>
      {rounded > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {t('metrics.vsLastWeek', { delta: `${rounded > 0 ? '+' : ''}${rounded}`, unit })}
    </span>
  )
}

export function MetricsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)

  const { data: habits = [] } = useHabits()
  const { data: workouts = [] } = useWorkouts(days)
  const { data: sleep = [] } = useSleep(days)
  const { data: weight = [] } = useWeight(days)
  const { data: nutrition = [] } = useNutrition(days)
  const { data: activity = [] } = useActivity(days)
  const { data: wellbeing = [] } = useWellbeing(days)

  const thisWeek = useMemo(() => getWeekBounds(0), [])
  const lastWeek = useMemo(() => getWeekBounds(1), [])

  const asc = <T extends { date: string }>(items: T[]) => [...items].sort((a, b) => a.date.localeCompare(b.date))

  // ── Week over week ────────────────────────────────────────────────────────
  const wThis = inWeek(workouts, thisWeek)
  const wLast = inWeek(workouts, lastWeek)
  const sleepThis = mean(inWeek(sleep, thisWeek).map(e => e.actualSleepMinutes ?? e.timeInBedMinutes).filter((v): v is number => v != null))
  const sleepLast = mean(inWeek(sleep, lastWeek).map(e => e.actualSleepMinutes ?? e.timeInBedMinutes).filter((v): v is number => v != null))
  const kcalThis = mean(inWeek(nutrition, thisWeek).map(e => e.kcal).filter((v): v is number => v != null))
  const kcalLast = mean(inWeek(nutrition, lastWeek).map(e => e.kcal).filter((v): v is number => v != null))
  const stepsThis = mean(inWeek(activity, thisWeek).map(e => e.steps).filter((v): v is number => v != null))
  const stepsLast = mean(inWeek(activity, lastWeek).map(e => e.steps).filter((v): v is number => v != null))

  const activeHabits = habits.filter(h => !h.archived)
  const doneToday = activeHabits.filter(h => h.completedToday).length

  // ── Range aggregates ──────────────────────────────────────────────────────
  const sleepMinutes = sleep.map(e => e.actualSleepMinutes ?? e.timeInBedMinutes).filter((v): v is number => v != null)
  const quality = sleep.map(e => e.quality).filter((v): v is number => v != null)
  const efficiency = sleep.map(e => e.efficiency).filter((v): v is number => v != null)

  const kcal = nutrition.map(e => e.kcal).filter((v): v is number => v != null)
  const protein = nutrition.map(e => e.proteinG).filter((v): v is number => v != null)
  const water = nutrition.map(e => e.waterL).filter((v): v is number => v != null)
  const coffee = nutrition.map(e => e.coffeeMl).filter((v): v is number => v != null)

  const steps = activity.map(e => e.steps).filter((v): v is number => v != null)
  const cardioDays = activity.filter(e => e.cardio).length
  const cardioMinutes = activity.map(e => e.cardioMinutes).filter((v): v is number => v != null)

  const round = (v: number | null, digits = 0) =>
    v == null
      ? '–'
      : (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString(dateLocale(), {
          maximumFractionDigits: digits,
        })

  const hunger = wellbeing.map(e => e.hunger).filter((v): v is number => v != null)
  const energy = wellbeing.map(e => e.energy).filter((v): v is number => v != null)

  const hasNothing = workouts.length === 0 && sleep.length === 0 && weight.length === 0
    && nutrition.length === 0 && activity.length === 0 && wellbeing.length === 0

  return (
    <div>
      <PageHeader title={t('metrics.title')} />

      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                days === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {t('metrics.days', { count: r })}
            </button>
          ))}
        </div>

        {hasNothing && (
          <p className="py-12 text-center text-sm text-gray-400 dark:text-zinc-500">{t('metrics.empty')}</p>
        )}

        <Card icon={<TrendingUp size={15} />} title={t('metrics.thisWeek')}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Stat label={t('nav.workouts')} value={String(wThis.length)} />
              <div className="mt-1"><Delta value={wThis.length - wLast.length} /></div>
            </div>
            <div>
              <Stat label={t('sleep.avgDuration')} value={formatDuration(sleepThis)} />
              <div className="mt-1">
                <Delta value={sleepThis != null && sleepLast != null ? (sleepThis - sleepLast) / 60 : null} unit="h" />
              </div>
            </div>
            <div>
              <Stat label={t('nutrition.calories')} value={kcalThis != null ? `${round(kcalThis)}` : '–'} />
              <div className="mt-1"><Delta value={kcalThis != null && kcalLast != null ? kcalThis - kcalLast : null} unit=" kcal" /></div>
            </div>
            <div>
              <Stat label={t('activity.steps')} value={stepsThis != null ? round(stepsThis) : '–'} />
              <div className="mt-1"><Delta value={stepsThis != null && stepsLast != null ? stepsThis - stepsLast : null} /></div>
            </div>
          </div>
        </Card>

        <Card icon={<Scale size={15} />} title={t('weight.title')}>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={t('weight.weightKg')}
              value={weight.find(e => e.weightKg != null)?.weightKg?.toString() ?? '–'}
              hint={t('metrics.latest')}
            />
            <Stat
              label={t('weight.waistCm')}
              value={weight.find(e => e.waistCm != null)?.waistCm?.toString() ?? '–'}
              hint={t('metrics.latest')}
            />
          </div>
          <MetricChart
            series={[
              { label: t('weight.weightKg'), color: '#6366f1', unit: ' kg', averageOver: 7, points: asc(weight).map(e => ({ date: e.date, value: e.weightKg })) },
              { label: t('weight.waistCm'), color: '#f59e0b', unit: ' cm', points: asc(weight).map(e => ({ date: e.date, value: e.waistCm })) },
            ]}
          />
        </Card>

        <Card icon={<Moon size={15} />} title={t('sleep.title')}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('sleep.avgDuration')} value={formatDuration(mean(sleepMinutes))} />
            <Stat label={t('sleep.avgQuality')} value={quality.length ? `${round(mean(quality))}%` : '–'} />
            <Stat label={t('sleep.avgEfficiency')} value={efficiency.length ? `${round(mean(efficiency))}%` : '–'} />
          </div>
          {quality.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-gray-400 dark:text-zinc-500">{t('sleep.qualityChart')}</p>
              <BarSeries points={asc(sleep).map(e => ({ date: e.date, value: e.quality }))} color="#818cf8" max={100} />
            </div>
          )}
        </Card>

        <Card icon={<Apple size={15} />} title={t('nutrition.title')}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('nutrition.calories')} value={kcal.length ? round(mean(kcal)) : '–'} hint={t('metrics.perDay')} />
            <Stat label={t('nutrition.protein')} value={protein.length ? `${round(mean(protein))} g` : '–'} hint={t('metrics.perDay')} />
            <Stat label={t('nutrition.water')} value={water.length ? `${round(mean(water), 1)} L` : '–'} hint={t('metrics.perDay')} />
            <Stat label={t('nutrition.coffee')} value={coffee.length ? `${round(mean(coffee))} ml` : '–'} hint={t('metrics.perDay')} />
          </div>
          {kcal.length > 0 && (
            <MetricChart
              series={[{ label: t('nutrition.calories'), color: '#34d399', unit: ' kcal', points: asc(nutrition).map(e => ({ date: e.date, value: e.kcal })) }]}
            />
          )}
        </Card>

        <Card icon={<Footprints size={15} />} title={t('activity.title')}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('activity.steps')} value={steps.length ? round(mean(steps)) : '–'} hint={t('metrics.perDay')} />
            <Stat label={t('activity.cardio')} value={String(cardioDays)} hint={t('metrics.days', { count: days })} />
            <Stat label={t('activity.cardioMinutes')} value={cardioMinutes.length ? `${round(mean(cardioMinutes))} min` : '–'} />
          </div>
          {steps.length > 0 && (
            <BarSeries points={asc(activity).map(e => ({ date: e.date, value: e.steps }))} color="#22d3ee" />
          )}
        </Card>

        <Card icon={<Dumbbell size={15} />} title={t('nav.workouts')}>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('metrics.sessions')} value={String(workouts.length)} />
            <Stat label={t('metrics.sets')} value={String(workouts.reduce((s, w) => s + w.setCount, 0))} />
            <Stat
              label={t('metrics.volume')}
              value={`${Math.round(workouts.reduce((s, w) => s + w.volumeKg, 0) / 1000)} t`}
            />
          </div>
        </Card>

        {wellbeing.length > 0 && (
          <Card icon={<Smile size={15} />} title={t('wellbeing.title')}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t('wellbeing.hunger')} value={hunger.length ? `${round(mean(hunger), 1)}/5` : '–'} hint={t('metrics.perDay')} />
              <Stat label={t('wellbeing.energy')} value={energy.length ? `${round(mean(energy), 1)}/5` : '–'} hint={t('metrics.perDay')} />
            </div>
          </Card>
        )}

        <Card icon={<CheckSquare size={15} />} title={t('nav.habits')}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('metrics.todayDone')} value={`${doneToday}/${activeHabits.length}`} />
            <Stat
              label={t('metrics.bestStreak')}
              value={String(activeHabits.reduce((best, h) => Math.max(best, h.streak), 0))}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
