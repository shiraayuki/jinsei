import { Link } from 'react-router-dom'
import { Flame, Check, Dumbbell, Play, ChevronRight } from 'lucide-react'
import { useAuth } from '../app/auth/AuthProvider'
import { useHabits, useLogEntry } from '../features/habits/hooks'
import { useWorkouts } from '../features/workouts/hooks'

function greeting() {
  const h = new Date().getHours()
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

  function toggleHabit(habitId: string, completedToday: boolean) {
    log.mutate({ habitId, date: today, completedCount: completedToday ? 0 : 1 })
  }

  return (
    <div className="min-h-dvh bg-zinc-950">
      {/* Hero greeting */}
      <div className="px-5 pb-5 pt-12">
        <p className="text-sm font-medium text-zinc-500">{formatDate()}</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-50">
          {greeting()}, {name}
        </h1>
      </div>

      <div className="space-y-3 px-4 pb-8">
        {/* Habit summary card */}
        {totalHabits > 0 && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Heute</p>
                <p className="mt-0.5 text-lg font-bold text-zinc-50">
                  {doneToday}
                  <span className="text-zinc-500">/{totalHabits} Habits</span>
                </p>
              </div>
              {/* Progress ring */}
              <div className="relative flex h-14 w-14 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" className="stroke-zinc-800" />
                  <circle
                    cx="24" cy="24" r="20" fill="none" strokeWidth="4"
                    strokeLinecap="round"
                    className="stroke-indigo-500 transition-all duration-500"
                    strokeDasharray={`${125.6}`}
                    strokeDashoffset={totalHabits > 0 ? 125.6 * (1 - doneToday / totalHabits) : 125.6}
                  />
                </svg>
                <span className="relative text-xs font-bold text-zinc-300">
                  {totalHabits > 0 ? Math.round((doneToday / totalHabits) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {activeHabits.slice(0, 4).map(habit => (
                <div key={habit.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <button
                    onClick={() => toggleHabit(habit.id, habit.completedToday)}
                    disabled={log.isPending}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
                      habit.completedToday
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900'
                        : 'border border-zinc-700 text-zinc-600 hover:border-indigo-500'
                    }`}
                  >
                    <Check size={13} strokeWidth={2.5} />
                  </button>
                  <span className={`flex-1 text-sm ${habit.completedToday ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                    {habit.name}
                  </span>
                  {habit.streak > 0 && !habit.completedToday && (
                    <span className="flex items-center gap-0.5 text-xs text-orange-400">
                      <Flame size={11} />
                      {habit.streak}
                    </span>
                  )}
                </div>
              ))}
              {activeHabits.length > 4 && (
                <Link to="/habits" className="block px-2 pt-1 text-xs text-zinc-600 hover:text-zinc-400">
                  +{activeHabits.length - 4} weitere →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* No habits yet */}
        {totalHabits === 0 && (
          <Link to="/habits/new" className="flex items-center justify-between rounded-2xl border border-dashed border-zinc-700 px-4 py-4 text-sm text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-colors">
            <span>Habits hinzufügen</span>
            <ChevronRight size={16} />
          </Link>
        )}

        {/* Workout section */}
        <div className="space-y-2">
          <Link
            to="/workouts/session"
            className="relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 px-5 py-4 shadow-lg shadow-indigo-950/50"
          >
            <div>
              <p className="font-bold text-white">{hasSession ? 'Session fortsetzen' : 'Workout starten'}</p>
              <p className="mt-0.5 text-xs text-indigo-200">
                {hasSession ? 'Dein Training läuft noch' : 'Timer starten & tracken'}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
              <Play size={20} className="text-white" fill="white" />
            </div>
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/5" />
          </Link>

          {lastWorkout && (
            <Link to={`/workouts/${lastWorkout.id}`} className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900 px-4 py-3 hover:border-zinc-700 transition-colors">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
                <Dumbbell size={18} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">Letztes Workout</p>
                <p className="text-sm font-semibold text-zinc-200">{lastWorkout.name ?? 'Workout'}</p>
                <p className="text-xs text-zinc-600">
                  {new Date(lastWorkout.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {lastWorkout.durationMinutes ? ` · ${lastWorkout.durationMinutes} min` : ''}
                  {` · ${lastWorkout.setCount} Sets`}
                </p>
              </div>
              <ChevronRight size={15} className="text-zinc-600" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
