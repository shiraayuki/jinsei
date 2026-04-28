import { Link } from 'react-router-dom'
import { Flame, Check, Dumbbell, Play, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useAuth } from '../app/auth/AuthProvider'
import { useHabits, useLogEntry } from '../features/habits/hooks'
import { useWorkouts } from '../features/workouts/hooks'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 12) return 'Guten Morgen'
  if (h < 17) return 'Guten Tag'
  return 'Guten Abend'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate() {
  return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
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
  const name = user?.displayName ?? user?.email?.split('@')[0] ?? 'du'
  const { data: habits } = useHabits()
  const { data: workouts } = useWorkouts()
  const log = useLogEntry()

  const today = todayIso()
  const activeHabits = habits?.filter(h => !h.archived) ?? []
  const doneToday = activeHabits.filter(h => h.completedToday).length
  const totalHabits = activeHabits.length
  const lastWorkout = workouts?.[0]

  const SESSION_KEY = 'jinsei:workout-session'
  const hasSession = !!localStorage.getItem(SESSION_KEY)

  const pct = totalHabits > 0 ? doneToday / totalHabits : 0
  const circumference = 125.6

  function toggleHabit(habitId: string, completedToday: boolean) {
    log.mutate({ habitId, date: today, completedCount: completedToday ? 0 : 1 })
  }

  return (
    <div className="min-h-dvh" style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(99,102,241,0.07) 0%, transparent 55%), #090909' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-5 pb-5 pt-12"
      >
        <p className="text-xs font-medium tracking-widest text-zinc-600 uppercase">{formatDate()}</p>
        <h1 className="mt-1 font-display text-[1.65rem] font-bold leading-tight text-zinc-50">
          {greeting()}, <span className="text-indigo-400">{name}</span>
        </h1>
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
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Heute</p>
                  <p className="mt-0.5 font-display text-xl font-bold text-zinc-50">
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
                  <span className="relative font-display text-xs font-bold text-zinc-300">
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
                    <span className={`flex-1 text-sm ${habit.completedToday ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
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
                    +{activeHabits.length - 4} weitere →
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {totalHabits === 0 && (
          <motion.div variants={fadeUp} transition={{ duration: 0.35 }}>
            <Link to="/habits/new" className="flex items-center justify-between rounded-2xl border border-dashed border-zinc-800 px-4 py-4 text-sm text-zinc-600 hover:border-indigo-500/40 hover:text-zinc-400 transition-colors">
              <span>Habits hinzufügen</span>
              <ChevronRight size={16} />
            </Link>
          </motion.div>
        )}

        {/* Workout section */}
        <motion.div variants={fadeUp} transition={{ duration: 0.35 }} className="space-y-2">
          <Link
            to="/workouts/session"
            className="relative flex items-center justify-between overflow-hidden rounded-2xl px-5 py-4 shadow-lg shadow-indigo-950/40"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
          >
            <div>
              <p className="font-display font-bold text-white text-[15px]">
                {hasSession ? 'Session fortsetzen' : 'Workout starten'}
              </p>
              <p className="mt-0.5 text-xs text-indigo-200/80">
                {hasSession ? 'Dein Training läuft noch' : 'Timer starten & tracken'}
              </p>
            </div>
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <Play size={20} className="text-white" fill="white" />
            </motion.div>
            <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -left-2 bottom-0 h-12 w-12 rounded-full bg-white/3" />
          </Link>

          {lastWorkout && (
            <Link to={`/workouts/${lastWorkout.id}`} className="card flex items-center gap-3 rounded-2xl px-4 py-3 hover:border-white/10 transition-colors">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(99,102,241,0.1)' }}>
                <Dumbbell size={18} strokeWidth={1.8} className="text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-600">Letztes Workout</p>
                <p className="text-sm font-semibold text-zinc-200">{lastWorkout.name ?? 'Workout'}</p>
                <p className="text-xs text-zinc-600">
                  {new Date(lastWorkout.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
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
