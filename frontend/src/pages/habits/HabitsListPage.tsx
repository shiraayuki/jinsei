import { Link } from 'react-router-dom'
import { Plus, Flame, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useHabits, useLogEntry } from '../../features/habits/hooks'
import type { Habit } from '../../features/habits/api'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function HabitRow({ habit }: { habit: Habit }) {
  const log = useLogEntry()

  function toggle() {
    log.mutate({ habitId: habit.id, date: todayIso(), completedCount: habit.completedToday ? 0 : 1 })
  }

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all ${
      habit.completedToday
        ? 'border-indigo-900/40 bg-indigo-950/20'
        : 'border-gray-200/80 dark:border-gray-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900'
    }`}>
      <button
        onClick={toggle}
        disabled={log.isPending}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
          habit.completedToday
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/60'
            : 'border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-600 hover:border-indigo-500 hover:text-indigo-400'
        }`}
      >
        <Check size={15} strokeWidth={2.5} />
      </button>

      <Link to={`/habits/${habit.id}`} className="min-w-0 flex-1">
        <p className={`font-semibold transition-colors ${habit.completedToday ? 'text-gray-400 dark:text-zinc-500 line-through decoration-zinc-600' : 'text-gray-800 dark:text-zinc-100'}`}>
          {habit.name}
        </p>
        {habit.streak > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-orange-400">
            <Flame size={11} />
            {habit.streak} Tag{habit.streak !== 1 ? 'e' : ''} in Folge
          </p>
        )}
      </Link>

      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: habit.color }}
      />
    </div>
  )
}

export function HabitsListPage() {
  const { data: habits, isLoading } = useHabits()
  const active = habits?.filter(h => !h.archived) ?? []
  const done = active.filter(h => h.completedToday).length

  return (
    <div>
      <PageHeader
        title="Habits"
        action={
          <Link
            to="/habits/new"
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:bg-zinc-700 transition-colors"
          >
            <Plus size={14} />
            Neu
          </Link>
        }
      />

      <div className="px-4 pt-2 pb-8 space-y-2">
        {/* Progress summary */}
        {active.length > 0 && (
          <div className="flex items-center justify-between px-1 pb-1">
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              <span className="font-semibold text-gray-700 dark:text-zinc-200">{done}</span>/{active.length} heute
            </p>
            {done === active.length && active.length > 0 && (
              <p className="text-xs font-medium text-indigo-400">Alle erledigt ✓</p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-2xl bg-gray-100/50 dark:bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && active.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-medium text-gray-500 dark:text-zinc-400">Noch keine Habits</p>
            <p className="text-sm text-gray-400 dark:text-zinc-600">Starte mit einer kleinen täglichen Gewohnheit.</p>
            <Link
              to="/habits/new"
              className="mt-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-950/60 hover:bg-indigo-500"
            >
              Ersten Habit erstellen
            </Link>
          </div>
        )}

        {active.map(habit => <HabitRow key={habit.id} habit={habit} />)}
      </div>
    </div>
  )
}
