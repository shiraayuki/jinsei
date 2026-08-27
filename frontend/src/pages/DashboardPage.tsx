import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Apple, Coffee, Droplet, Flame, Check, ChevronDown, ChevronRight, ChevronUp,
  Dumbbell, Eye, EyeOff, Footprints, Moon, Scale, SlidersHorizontal, UserCircle,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useAuth } from '../app/auth/AuthProvider'
import { useHabits, useLogEntry } from '../features/habits/hooks'
import { useWorkouts } from '../features/workouts/hooks'
import { useSleep } from '../features/sleep/hooks'
import { useWeight } from '../features/weight/hooks'
import { useNutritionDay, useUpsertNutrition } from '../features/nutrition/hooks'
import { useActivityDay } from '../features/activity/hooks'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../i18n'
import { todayIso } from '../lib/date'
import { moduleColor, moduleTint } from '../lib/modules'
import { useWidgetLayout, type WidgetKey } from '../lib/dashboardWidgets'
import { Chart } from '../components/charts/Chart'
import { densify, latest, mean, movingAverage } from '../lib/stats'
import { shiftIso } from '../lib/date'

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function nowHhMm() {
  return new Date().toTimeString().slice(0, 5)
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

export function DashboardPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const name = user?.displayName ?? user?.email?.split('@')[0] ?? 'you'
  const { layout, move, toggle, reset } = useWidgetLayout()
  const [editing, setEditing] = useState(false)

  function greeting() {
    const h = new Date().getHours()
    if (h < 5) return t('dashboard.greetings.night')
    if (h < 12) return t('dashboard.greetings.morning')
    if (h < 17) return t('dashboard.greetings.afternoon')
    return t('dashboard.greetings.evening')
  }

  function formatDate() {
    return new Date().toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const { data: habits } = useHabits()
  const { data: workouts } = useWorkouts()
  const { data: sleepEntries = [] } = useSleep(14)
  const { data: weightEntries = [] } = useWeight(30)
  const { data: todayNutrition } = useNutritionDay(todayIso())
  const { data: todayActivity } = useActivityDay(todayIso())
  const quickAdd = useUpsertNutrition()
  const log = useLogEntry()

  const today = todayIso()
  const activeHabits = habits?.filter(h => !h.archived) ?? []
  const doneToday = activeHabits.filter(h => h.completedToday).length
  const totalHabits = activeHabits.length
  const lastWorkout = workouts?.[0]

  // Prefer the measured sleep; fall back to time in bed when only that was logged.
  const lastNight = sleepEntries[0]
  const lastNightMinutes = lastNight
    ? lastNight.actualSleepMinutes ?? lastNight.timeInBedMinutes
    : null

  const weighed = weightEntries.filter(e => e.weightKg != null)
  const weightPoints = densify(
    weightEntries.map(e => ({ date: e.date, value: e.weightKg })),
    shiftIso(today, -29),
    today,
  )
  const weightTrend = movingAverage(weightPoints, 7, 3)
  // The delta is trend against trend a week ago, not weigh-in against weigh-in:
  // a salty dinner moves the scale by more than a week of deficit does.
  const trendNow = latest(weightTrend)
  const trendBefore = latest(weightTrend.slice(0, -7))
  const weightDelta =
    trendNow != null && trendBefore != null ? +(trendNow - trendBefore).toFixed(1) : null

  const sleepPoints = densify(
    sleepEntries.map(e => ({ date: e.date, value: e.actualSleepMinutes ?? e.timeInBedMinutes })),
    shiftIso(today, -13),
    today,
  )

  /** Writes the whole day back, since the endpoint replaces the row it is given. */
  function addDrink(patch: { waterL?: number; coffeeMl?: number; lastCoffee?: string }) {
    quickAdd.mutate({
      date: todayIso(),
      kcal: todayNutrition?.kcal ?? null,
      proteinG: todayNutrition?.proteinG ?? null,
      carbsG: todayNutrition?.carbsG ?? null,
      fatG: todayNutrition?.fatG ?? null,
      waterL: patch.waterL ?? todayNutrition?.waterL ?? null,
      coffeeMl: patch.coffeeMl ?? todayNutrition?.coffeeMl ?? null,
      lastCoffee: patch.lastCoffee ?? todayNutrition?.lastCoffee ?? null,
      notes: todayNutrition?.notes ?? null,
    })
  }

  const pct = totalHabits > 0 ? doneToday / totalHabits : 0
  const circumference = 125.6

  function toggleHabit(habitId: string, completedToday: boolean) {
    log.mutate({ habitId, date: today, completedCount: completedToday ? 0 : 1 })
  }

  const widgets: Record<WidgetKey, React.ReactNode> = {
    habits: totalHabits > 0 ? (
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-label font-semibold uppercase tracking-widest text-ink-mute">{t('dashboard.today')}</p>
            <p className="mt-0.5 font-display text-value font-bold text-ink">
              {doneToday}
              <span className="text-ink-mute font-normal text-title">/{totalHabits} Habits</span>
            </p>
          </div>

          <div className="relative flex h-14 w-14 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3.5" style={{ stroke: 'var(--line)' }} />
              <motion.circle
                cx="24" cy="24" r="20" fill="none" strokeWidth="3.5"
                strokeLinecap="round"
                style={{ stroke: moduleColor.mind }}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - pct) }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </svg>
            <span className="relative font-display text-meta font-bold text-ink-soft">
              {Math.round(pct * 100)}%
            </span>
          </div>
        </div>

        <div className="space-y-0.5">
          {activeHabits.slice(0, 4).map(habit => (
            <div key={habit.id} className="flex items-center gap-3 rounded-control px-2 py-1.5">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => toggleHabit(habit.id, habit.completedToday)}
                disabled={log.isPending}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-chip transition-colors ${
                  habit.completedToday
                    ? 'bg-mind text-white'
                    : 'border border-line-strong text-ink-faint hover:border-mind'
                }`}
              >
                <motion.div
                  animate={habit.completedToday ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: 0.25 }}
                >
                  <Check size={13} strokeWidth={1.75} />
                </motion.div>
              </motion.button>
              <span className={`flex-1 text-body ${habit.completedToday ? 'text-ink-faint line-through' : 'text-ink'}`}>
                {habit.name}
              </span>
              {habit.streak > 0 && !habit.completedToday && (
                <span className="flex items-center gap-0.5 text-meta text-warn font-medium">
                  <Flame size={11} />
                  {habit.streak}
                </span>
              )}
            </div>
          ))}
          {activeHabits.length > 4 && (
            <Link to="/habits" className="block px-2 pt-1.5 text-meta text-ink-mute hover:text-accent transition-colors">
              {t('dashboard.moreHabits', { count: activeHabits.length - 4 })}
            </Link>
          )}
        </div>
      </div>
    ) : (
      <Link to="/habits/new" className="flex items-center justify-between rounded-card border border-dashed border-line px-4 py-4 text-body text-ink-mute hover:border-accent hover:text-ink-soft transition-colors">
        <span>{t('dashboard.addHabits')}</span>
        <ChevronRight size={16} />
      </Link>
    ),

    today: (
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-label font-semibold uppercase tracking-widest text-ink-mute">{t('dashboard.todaySoFar')}</p>
          <Link to="/today" className="flex items-center gap-1 text-meta text-ink-mute hover:text-accent transition-colors">
            {t('dashboard.logNow')} <ChevronRight size={11} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link to="/today" className="flex items-center gap-2.5 rounded-control bg-raised px-3 py-2.5 hover:bg-line transition-colors">
            <Apple size={15} className="shrink-0 text-food" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="truncate font-display text-title font-semibold text-ink leading-none tabular">
                {todayNutrition?.kcal != null ? todayNutrition.kcal.toLocaleString(dateLocale()) : '–'}
              </p>
              <p className="mt-0.5 truncate text-label text-ink-mute">
                {todayNutrition?.proteinG != null
                  ? t('dashboard.kcalWithProtein', { protein: todayNutrition.proteinG })
                  : 'kcal'}
              </p>
            </div>
          </Link>

          <Link to="/today" className="flex items-center gap-2.5 rounded-control bg-raised px-3 py-2.5 hover:bg-line transition-colors">
            <Footprints size={15} className="shrink-0 text-move" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="truncate font-display text-title font-semibold text-ink leading-none tabular">
                {todayActivity?.steps != null ? todayActivity.steps.toLocaleString(dateLocale()) : '–'}
              </p>
              <p className="mt-0.5 truncate text-label text-ink-mute">{t('activity.stepsUnit')}</p>
            </div>
          </Link>

          <Link to="/today" className="flex items-center gap-2.5 rounded-control bg-raised px-3 py-2.5 hover:bg-line transition-colors">
            <Moon size={15} className="shrink-0 text-sleep" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="truncate font-display text-title font-semibold text-ink leading-none tabular">
                {lastNightMinutes != null ? formatDuration(lastNightMinutes) : '–'}
              </p>
              <p className="mt-0.5 truncate text-label text-ink-mute">{t('dashboard.lastNight')}</p>
            </div>
          </Link>

          <Link to="/today" className="flex items-center gap-2.5 rounded-control bg-raised px-3 py-2.5 hover:bg-line transition-colors">
            <Scale size={15} className="shrink-0 text-body" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="truncate font-display text-title font-semibold text-ink leading-none tabular">
                {weighed[0]?.weightKg != null ? `${weighed[0].weightKg} kg` : '–'}
              </p>
              {weightDelta != null ? (
                <p className={`mt-0.5 text-label ${weightDelta > 0 ? 'text-bad' : weightDelta < 0 ? 'text-good' : 'text-ink-mute'}`}>
                  {weightDelta > 0 ? '+' : ''}{weightDelta} kg
                </p>
              ) : (
                <p className="mt-0.5 truncate text-label text-ink-mute">{t('dashboard.weight')}</p>
              )}
            </div>
          </Link>
        </div>

        <Link to="/metrics" className="mt-2 flex items-center justify-end gap-1 text-meta text-ink-mute hover:text-accent transition-colors">
          {t('metrics.title')} <ChevronRight size={11} />
        </Link>
      </div>
    ),

    drinks: (
      // Water and coffee are the two things logged repeatedly during the day,
      // so they get a one-tap path that saves straight away.
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-control bg-surface px-3 py-2.5 shadow-[var(--card-shadow)]">
          <Droplet size={14} className="shrink-0 text-food" strokeWidth={1.75} />
          <span className="text-body font-semibold text-ink">
            {(todayNutrition?.waterL ?? 0).toLocaleString(dateLocale())}
          </span>
          <span className="text-label text-ink-mute">L</span>
          <button
            onClick={() => addDrink({ waterL: (todayNutrition?.waterL ?? 0) + 0.25 })}
            disabled={quickAdd.isPending}
            className="ml-auto rounded-chip bg-raised px-2 py-1 text-meta font-medium text-ink hover:bg-line disabled:opacity-40"
          >
            +0,25
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-control bg-surface px-3 py-2.5 shadow-[var(--card-shadow)]">
          <Coffee size={14} className="shrink-0 text-food" strokeWidth={1.75} />
          <span className="text-body font-semibold text-ink">{todayNutrition?.coffeeMl ?? 0}</span>
          <span className="text-label text-ink-mute">ml</span>
          <button
            onClick={() => addDrink({ coffeeMl: (todayNutrition?.coffeeMl ?? 0) + 200, lastCoffee: nowHhMm() })}
            disabled={quickAdd.isPending}
            className="ml-auto rounded-chip bg-raised px-2 py-1 text-meta font-medium text-ink hover:bg-line disabled:opacity-40"
          >
            +200
          </button>
        </div>
      </div>
    ),

    weight: weighed.length > 1 ? (
      <div className="card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-label font-semibold uppercase tracking-widest text-ink-mute">
            {t('dashboard.widgets.weight')}
          </p>
          <p className="font-display text-title font-semibold text-ink tabular">
            {trendNow != null ? `${trendNow.toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} kg` : '–'}
          </p>
        </div>
        <Chart
          series={[{ label: t('weight.weightKg'), color: moduleColor.body, points: weightPoints, unit: ' kg', averageOver: 7 }]}
          goal={user?.weightGoalKg != null ? { value: user.weightGoalKg, label: t('metrics.goal') } : undefined}
          height={84}
          format={v => v.toLocaleString(dateLocale(), { maximumFractionDigits: 1 })}
        />
      </div>
    ) : null,

    sleep: sleepEntries.length > 0 ? (
      <div className="card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-label font-semibold uppercase tracking-widest text-ink-mute">
            {t('dashboard.widgets.sleep')}
          </p>
          <p className="font-display text-title font-semibold text-ink tabular">
            {formatDuration(mean(sleepPoints.map(p => p.value).filter((v): v is number => v != null)) ?? 0)}
          </p>
        </div>
        <Chart
          series={[{ label: t('sleep.title'), color: moduleColor.sleep, points: sleepPoints, kind: 'bar', unit: ' h' }]}
          goal={user?.sleepGoalMinutes != null ? { value: user.sleepGoalMinutes, label: t('metrics.goal') } : undefined}
          height={84}
          zeroBased
          format={v => (v / 60).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })}
        />
      </div>
    ) : null,

    workout: lastWorkout ? (
      <Link to={`/workouts/${lastWorkout.id}`} className="card flex items-center gap-3 rounded-card px-4 py-3 hover:border-white/10 transition-colors">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control"
          style={{ background: moduleTint('train'), color: moduleColor.train }}
        >
          <Dumbbell size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-meta text-ink-faint">{t('dashboard.lastWorkout')}</p>
          <p className="text-body font-semibold text-ink">{lastWorkout.title}</p>
          <p className="text-meta text-ink-faint">
            {new Date(lastWorkout.date + 'T00:00:00').toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })}
            {lastWorkout.durationMinutes ? ` · ${lastWorkout.durationMinutes} min` : ''}
            {` · ${lastWorkout.setCount} Sets`}
          </p>
        </div>
        <ChevronRight size={15} className="text-ink-faint" />
      </Link>
    ) : null,
  }

  return (
    <div className="min-h-dvh app-bg" style={{ backgroundImage: 'radial-gradient(ellipse at 50% -10%, var(--accent-soft) 0%, transparent 55%)' }}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start gap-3 px-5 pb-5 pt-12"
      >
        <div className="min-w-0 flex-1">
          <p className="text-meta font-medium tracking-widest text-ink-mute uppercase">{formatDate()}</p>
          <h1 className="mt-1 font-display text-head font-bold leading-tight text-ink">
            {greeting()}, <span className="text-accent">{name}</span>
          </h1>
        </div>
        <button
          onClick={() => setEditing(v => !v)}
          aria-label={t('dashboard.customize')}
          aria-pressed={editing}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            editing ? 'bg-accent text-white' : 'text-ink-mute hover:text-accent'
          }`}
        >
          <SlidersHorizontal size={19} strokeWidth={1.75} />
        </button>
        <Link
          to="/profile"
          aria-label={t('nav.profile')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-mute hover:text-accent transition-colors"
        >
          <UserCircle size={24} strokeWidth={1.75} />
        </Link>
      </motion.div>

      {editing ? (
        // In edit mode the cards are replaced by their names: reordering is
        // about the list, and full cards would put two rows between the arrows.
        <div className="space-y-2 px-4 pb-8">
          {layout.map((widget, i) => (
            <div key={widget.key} className="flex items-center gap-2 rounded-control bg-surface px-3 py-2.5 shadow-[var(--card-shadow)]">
              <span className={`flex-1 truncate text-body ${widget.visible ? 'text-ink' : 'text-ink-faint'}`}>
                {t(`dashboard.widgets.${widget.key}`)}
              </span>
              <button
                onClick={() => toggle(widget.key)}
                aria-label={t('dashboard.hidden')}
                className="flex h-8 w-8 items-center justify-center rounded-chip text-ink-mute hover:bg-raised"
              >
                {widget.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button
                onClick={() => move(widget.key, -1)}
                disabled={i === 0}
                aria-label="↑"
                className="flex h-8 w-8 items-center justify-center rounded-chip text-ink-mute hover:bg-raised disabled:opacity-30"
              >
                <ChevronUp size={15} />
              </button>
              <button
                onClick={() => move(widget.key, 1)}
                disabled={i === layout.length - 1}
                aria-label="↓"
                className="flex h-8 w-8 items-center justify-center rounded-chip text-ink-mute hover:bg-raised disabled:opacity-30"
              >
                <ChevronDown size={15} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
              className="flex-1 rounded-control bg-raised py-2.5 text-meta font-medium text-ink-soft hover:bg-line"
            >
              {t('dashboard.resetLayout')}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 rounded-control bg-accent py-2.5 text-meta font-medium text-white"
            >
              {t('dashboard.done')}
            </button>
          </div>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3 px-4 pb-8">
          {layout
            .filter(w => w.visible && widgets[w.key] != null)
            .map(w => (
              <motion.div key={w.key} variants={fadeUp} transition={{ duration: 0.35 }}>
                {widgets[w.key]}
              </motion.div>
            ))}
        </motion.div>
      )}
    </div>
  )
}
