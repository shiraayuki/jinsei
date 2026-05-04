import { useMemo } from 'react'
import { motion } from 'motion/react'
import { CheckSquare, Dumbbell, Moon, Scale, TrendingUp, TrendingDown, Minus, Flame } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { useHabits } from '../features/habits/hooks'
import { useWorkouts } from '../features/workouts/hooks'
import { useSleep } from '../features/sleep/hooks'
import { useWeight } from '../features/weight/hooks'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../i18n'

function getWeekBounds(weeksAgo = 0) {
  const today = new Date()
  const daysBack = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysBack - weeksAgo * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

function filterByWeek<T extends { date: string }>(items: T[], week: { start: string; end: string }) {
  return items.filter(i => i.date >= week.start && i.date <= week.end)
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function TrendBadge({ delta, unit = '', invert = false }: { delta: number; unit?: string; invert?: boolean }) {
  const { t } = useTranslation()
  const isPositive = invert ? delta < 0 : delta > 0
  if (delta === 0) return (
    <span className="flex items-center gap-1 text-[11px] text-zinc-500">
      <Minus size={11} />
      {t('review.vsLastWeek', { delta: '±0', unit: '' })}
    </span>
  )
  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {t('review.vsLastWeek', { delta: `${delta > 0 ? '+' : ''}${delta}`, unit })}
    </span>
  )
}

function ReviewCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl bg-white dark:bg-zinc-900 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{title}</p>
      </div>
      {children}
    </motion.div>
  )
}

export function WeeklyReviewPage() {
  const { t } = useTranslation()

  const thisWeek = useMemo(() => getWeekBounds(0), [])
  const lastWeek = useMemo(() => getWeekBounds(1), [])

  const { data: habits = [] } = useHabits()
  const { data: thisWeekWorkouts = [] } = useWorkouts(thisWeek.start, thisWeek.end)
  const { data: lastWeekWorkouts = [] } = useWorkouts(lastWeek.start, lastWeek.end)
  const { data: sleepEntries = [] } = useSleep(21)
  const { data: weightEntries = [] } = useWeight(21)

  // ── Habits ────────────────────────────────────────────────────────────────
  const activeHabits = habits.filter(h => !h.archived)
  const doneToday = activeHabits.filter(h => h.completedToday).length
  const topStreaks = [...activeHabits].sort((a, b) => b.streak - a.streak).filter(h => h.streak > 0).slice(0, 3)
  const habitPct = activeHabits.length > 0 ? Math.round(doneToday / activeHabits.length * 100) : 0

  // ── Workouts ──────────────────────────────────────────────────────────────
  const thisWorkoutMins = thisWeekWorkouts.reduce((s, w) => s + (w.durationMinutes ?? 0), 0)
  const thisSetCount = thisWeekWorkouts.reduce((s, w) => s + w.setCount, 0)
  const workoutDelta = thisWeekWorkouts.length - lastWeekWorkouts.length

  // ── Sleep ─────────────────────────────────────────────────────────────────
  const thisSleep = filterByWeek(sleepEntries, thisWeek)
  const lastSleep = filterByWeek(sleepEntries, lastWeek)

  const avgSleepMins = thisSleep.length > 0
    ? Math.round(thisSleep.reduce((s, e) => s + e.durationMinutes, 0) / thisSleep.length)
    : null
  const lastAvgSleepMins = lastSleep.length > 0
    ? Math.round(lastSleep.reduce((s, e) => s + e.durationMinutes, 0) / lastSleep.length)
    : null
  const avgQuality = thisSleep.length > 0
    ? (thisSleep.reduce((s, e) => s + e.quality, 0) / thisSleep.length).toFixed(1)
    : null
  const sleepDeltaMins = avgSleepMins != null && lastAvgSleepMins != null
    ? avgSleepMins - lastAvgSleepMins
    : null
  const sleepDeltaH = sleepDeltaMins != null
    ? Math.round(sleepDeltaMins / 60 * 10) / 10
    : null

  // ── Weight ────────────────────────────────────────────────────────────────
  const thisWeightEntries = filterByWeek(weightEntries, thisWeek)
  const latestWeight = weightEntries[0]
  const weekStartWeight = thisWeightEntries.length > 1
    ? thisWeightEntries[thisWeightEntries.length - 1]
    : null
  const weightChange = latestWeight && weekStartWeight
    ? +(latestWeight.weightKg - weekStartWeight.weightKg).toFixed(1)
    : null

  // ── Week label ────────────────────────────────────────────────────────────
  const weekLabel = (() => {
    const fmt = (iso: string) =>
      new Date(iso + 'T00:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
    return `${fmt(thisWeek.start)} – ${fmt(thisWeek.end)}`
  })()

  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pb-10">
      <PageHeader title={t('review.title')} back />

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-1 text-xs text-zinc-500"
      >
        {weekLabel}
      </motion.p>

      {/* Habits */}
      <ReviewCard
        icon={<CheckSquare size={16} className="text-indigo-400" strokeWidth={1.8} />}
        title={t('nav.habits')}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {doneToday}
              <span className="text-base font-normal text-zinc-500">/{activeHabits.length}</span>
            </p>
            <p className="text-[10px] text-zinc-500">{t('dashboard.habitsToday')}</p>
          </div>
          {activeHabits.length > 0 && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(rgb(99 102 241) ${habitPct * 3.6}deg, rgb(39 39 42) 0deg)` }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-zinc-900">
                <span className="text-xs font-bold text-indigo-400">{habitPct}%</span>
              </div>
            </div>
          )}
        </div>
        {topStreaks.length > 0 && (
          <div className="space-y-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            {topStreaks.map(h => (
              <div key={h.id} className="flex items-center justify-between">
                <p className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">{h.name}</p>
                <span className="ml-3 flex shrink-0 items-center gap-1 text-xs font-medium text-orange-400">
                  <Flame size={11} />
                  {h.streak}d
                </span>
              </div>
            ))}
          </div>
        )}
      </ReviewCard>

      {/* Workouts */}
      <ReviewCard
        icon={<Dumbbell size={16} className="text-indigo-400" strokeWidth={1.8} />}
        title={t('nav.workouts')}
      >
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{thisWeekWorkouts.length}</p>
            <p className="text-[10px] text-zinc-500">{t('review.sessions')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {thisWorkoutMins > 0 ? `${thisWorkoutMins}` : '–'}
            </p>
            <p className="text-[10px] text-zinc-500">{t('review.minutes')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {thisSetCount > 0 ? thisSetCount : '–'}
            </p>
            <p className="text-[10px] text-zinc-500">Sets</p>
          </div>
        </div>
        <TrendBadge delta={workoutDelta} unit={` ${t('review.sessions')}`} />
        {thisWeekWorkouts.length > 0 && (
          <div className="space-y-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            {thisWeekWorkouts.map(w => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{w.name ?? 'Workout'}</span>
                <span className="ml-2 shrink-0 text-xs text-zinc-500">
                  {new Date(w.date + 'T00:00:00').toLocaleDateString(dateLocale(), { weekday: 'short' })}
                  {w.durationMinutes ? ` · ${w.durationMinutes}m` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
        {thisWeekWorkouts.length === 0 && (
          <p className="text-sm text-zinc-500">{t('review.noWorkouts')}</p>
        )}
      </ReviewCard>

      {/* Sleep */}
      <ReviewCard
        icon={<Moon size={16} className="text-violet-400" strokeWidth={1.8} />}
        title={t('nav.sleep')}
      >
        {avgSleepMins != null ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(avgSleepMins)}</p>
                <p className="text-[10px] text-zinc-500">{t('sleep.avgDuration')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgQuality}<span className="text-base font-normal text-zinc-500">/5</span></p>
                <p className="text-[10px] text-zinc-500">{t('sleep.avgQuality')}</p>
              </div>
            </div>
            {sleepDeltaH != null && (
              <TrendBadge delta={sleepDeltaH} unit="h" />
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-500">{t('review.noData')}</p>
        )}
      </ReviewCard>

      {/* Weight */}
      <ReviewCard
        icon={<Scale size={16} className="text-sky-400" strokeWidth={1.8} />}
        title={t('nav.weight')}
      >
        {latestWeight ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{latestWeight.weightKg} kg</p>
              <p className="text-[10px] text-zinc-500">{t('review.latest')}</p>
            </div>
            {weightChange != null && (
              <div className="text-right">
                <p className={`text-xl font-bold ${weightChange > 0 ? 'text-rose-400' : weightChange < 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {weightChange > 0 ? '+' : ''}{weightChange} kg
                </p>
                <p className="text-[10px] text-zinc-500">{t('review.thisWeek')}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">{t('review.noData')}</p>
        )}
      </ReviewCard>
    </div>
  )
}
