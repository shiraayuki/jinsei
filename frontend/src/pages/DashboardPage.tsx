import { Link } from 'react-router-dom'
import { Apple, Coffee, Droplet, Flame, Check, Dumbbell, ChevronRight, Footprints, Moon, Scale, UserCircle } from 'lucide-react'
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

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
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
  const { data: sleepEntries = [] } = useSleep(7)
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
  const latestWeight = weighed[0]
  const prevWeight = weighed[1]
  const weightDelta = latestWeight?.weightKg != null && prevWeight?.weightKg != null
    ? +(latestWeight.weightKg - prevWeight.weightKg).toFixed(1)
    : null

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

  return (
    <div className="min-h-dvh app-bg" style={{ backgroundImage: 'radial-gradient(ellipse at 50% -10%, rgba(99,102,241,0.07) 0%, transparent 55%)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start gap-3 px-5 pb-5 pt-12"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-widest text-zinc-600 uppercase">{formatDate()}</p>
          <h1 className="mt-1 font-display text-[1.65rem] font-bold leading-tight text-zinc-800 dark:text-zinc-50">
            {greeting()}, <span className="text-indigo-400">{name}</span>
          </h1>
        </div>
        {/* Profile lost its nav slot when the bar went down to four tabs. */}
        <Link
          to="/profile"
          aria-label={t('nav.profile')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 dark:text-zinc-500 hover:text-indigo-400 transition-colors"
        >
          <UserCircle size={24} strokeWidth={1.6} />
        </Link>
      </motion.div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-3 px-4 pb-8"
      >
        {/* Habit card */}
        {totalHabits > 0 && (
          <motion.div variants={fadeUp} transition={{ duration: 0.35 }}>
            <div className="card rounded-2xl p-4 shadow-xl shadow-black/30">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{t('dashboard.today')}</p>
                  <p className="mt-0.5 font-display text-xl font-bold text-zinc-800 dark:text-zinc-50">
                    {doneToday}
                    <span className="text-zinc-500 font-normal text-base">/{totalHabits} Habits</span>
                  </p>
                </div>

                {/* Animated progress ring */}
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="20" fill="none" strokeWidth="3.5" stroke="rgba(255,255,255,0.06)" />
                    <motion.circle
                      cx="24" cy="24" r="20" fill="none" strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="url(#ringGrad)"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference * (1 - pct) }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    />
                    <defs>
                      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="relative font-display text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    {Math.round(pct * 100)}%
                  </span>
                </div>
              </div>

              <div className="space-y-0.5">
                {activeHabits.slice(0, 4).map(habit => (
                  <div key={habit.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => toggleHabit(habit.id, habit.completedToday)}
                      disabled={log.isPending}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        habit.completedToday
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/50'
                          : 'border border-zinc-700/80 text-zinc-700 hover:border-indigo-500/60'
                      }`}
                    >
                      <motion.div
                        animate={habit.completedToday ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                        transition={{ duration: 0.25 }}
                      >
                        <Check size={13} strokeWidth={2.5} />
                      </motion.div>
                    </motion.button>
                    <span className={`flex-1 text-sm ${habit.completedToday ? 'text-gray-400 dark:text-zinc-600 line-through' : 'text-gray-800 dark:text-zinc-200'}`}>
                      {habit.name}
                    </span>
                    {habit.streak > 0 && !habit.completedToday && (
                      <span className="flex items-center gap-0.5 text-xs text-orange-400 font-medium">
                        <Flame size={11} />
                        {habit.streak}
                      </span>
                    )}
                  </div>
                ))}
                {activeHabits.length > 4 && (
                  <Link to="/habits" className="block px-2 pt-1.5 text-xs text-zinc-600 hover:text-indigo-400 transition-colors">
                    {t('dashboard.moreHabits', { count: activeHabits.length - 4 })}
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {totalHabits === 0 && (
          <motion.div variants={fadeUp} transition={{ duration: 0.35 }}>
            <Link to="/habits/new" className="flex items-center justify-between rounded-2xl border border-dashed border-zinc-800 px-4 py-4 text-sm text-zinc-600 hover:border-indigo-500/40 hover:text-zinc-400 transition-colors">
              <span>{t('dashboard.addHabits')}</span>
              <ChevronRight size={16} />
            </Link>
          </motion.div>
        )}

        {/* What the day looks like so far */}
        <motion.div variants={fadeUp} transition={{ duration: 0.35 }}>
          <div className="card rounded-2xl p-4 shadow-xl shadow-black/30">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{t('dashboard.todaySoFar')}</p>
              <Link to="/today" className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-indigo-400 transition-colors">
                {t('dashboard.logNow')} <ChevronRight size={11} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link to="/today" className="flex items-center gap-2.5 rounded-xl bg-zinc-800/50 px-3 py-2.5 hover:bg-zinc-700/50 transition-colors">
                <Apple size={15} className="shrink-0 text-emerald-400" strokeWidth={1.8} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-zinc-100 leading-none">
                    {todayNutrition?.kcal != null ? todayNutrition.kcal.toLocaleString(dateLocale()) : '–'}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                    {todayNutrition?.proteinG != null
                      ? t('dashboard.kcalWithProtein', { protein: todayNutrition.proteinG })
                      : 'kcal'}
                  </p>
                </div>
              </Link>

              <Link to="/today" className="flex items-center gap-2.5 rounded-xl bg-zinc-800/50 px-3 py-2.5 hover:bg-zinc-700/50 transition-colors">
                <Footprints size={15} className="shrink-0 text-cyan-400" strokeWidth={1.8} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-zinc-100 leading-none">
                    {todayActivity?.steps != null ? todayActivity.steps.toLocaleString(dateLocale()) : '–'}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-500">{t('activity.stepsUnit')}</p>
                </div>
              </Link>

              <Link to="/today" className="flex items-center gap-2.5 rounded-xl bg-zinc-800/50 px-3 py-2.5 hover:bg-zinc-700/50 transition-colors">
                <Moon size={15} className="shrink-0 text-violet-400" strokeWidth={1.8} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-zinc-100 leading-none">
                    {lastNightMinutes != null ? formatDuration(lastNightMinutes) : '–'}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-zinc-500">{t('dashboard.lastNight')}</p>
                </div>
              </Link>

              <Link to="/today" className="flex items-center gap-2.5 rounded-xl bg-zinc-800/50 px-3 py-2.5 hover:bg-zinc-700/50 transition-colors">
                <Scale size={15} className="shrink-0 text-sky-400" strokeWidth={1.8} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-zinc-100 leading-none">
                    {latestWeight?.weightKg != null ? `${latestWeight.weightKg} kg` : '–'}
                  </p>
                  {weightDelta != null ? (
                    <p className={`mt-0.5 text-[10px] ${weightDelta > 0 ? 'text-rose-400' : weightDelta < 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {weightDelta > 0 ? '+' : ''}{weightDelta} kg
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-[10px] text-zinc-500">{t('dashboard.weight')}</p>
                  )}
                </div>
              </Link>
            </div>

            {/* Water and coffee are the two things logged repeatedly during the
                day, so they get a one-tap path that saves straight away. */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-zinc-800/50 px-3 py-2">
                <Droplet size={14} className="shrink-0 text-blue-400" strokeWidth={1.8} />
                <span className="text-sm font-semibold text-zinc-100">
                  {(todayNutrition?.waterL ?? 0).toLocaleString(dateLocale())}
                </span>
                <span className="text-[10px] text-zinc-500">L</span>
                <button
                  onClick={() => addDrink({ waterL: (todayNutrition?.waterL ?? 0) + 0.25 })}
                  disabled={quickAdd.isPending}
                  className="ml-auto rounded-lg bg-zinc-700/60 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-600/60 disabled:opacity-40"
                >
                  +0,25
                </button>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-zinc-800/50 px-3 py-2">
                <Coffee size={14} className="shrink-0 text-amber-400" strokeWidth={1.8} />
                <span className="text-sm font-semibold text-zinc-100">{todayNutrition?.coffeeMl ?? 0}</span>
                <span className="text-[10px] text-zinc-500">ml</span>
                <button
                  onClick={() => addDrink({ coffeeMl: (todayNutrition?.coffeeMl ?? 0) + 200, lastCoffee: nowHhMm() })}
                  disabled={quickAdd.isPending}
                  className="ml-auto rounded-lg bg-zinc-700/60 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-600/60 disabled:opacity-40"
                >
                  +200
                </button>
              </div>
            </div>

            <Link to="/metrics" className="mt-2 flex items-center justify-end gap-1 text-[11px] text-zinc-600 hover:text-indigo-400 transition-colors">
              {t('metrics.title')} <ChevronRight size={11} />
            </Link>
          </div>
        </motion.div>

        {/* Workout section */}
        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="space-y-2">
          {lastWorkout && (
            <Link to={`/workouts/${lastWorkout.id}`} className="card flex items-center gap-3 rounded-2xl px-4 py-3 hover:border-white/10 transition-colors">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(99,102,241,0.1)' }}>
                <Dumbbell size={18} strokeWidth={1.8} className="text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400 dark:text-zinc-600">{t('dashboard.lastWorkout')}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{lastWorkout.title}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-600">
                  {new Date(lastWorkout.date + 'T00:00:00').toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })}
                  {lastWorkout.durationMinutes ? ` · ${lastWorkout.durationMinutes} min` : ''}
                  {` · ${lastWorkout.setCount} Sets`}
                </p>
              </div>
              <ChevronRight size={15} className="text-zinc-700" />
            </Link>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
