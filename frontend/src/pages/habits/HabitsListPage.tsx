import { Link } from 'react-router-dom'
import { Plus, Flame, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { useHabits, useLogEntry } from '../../features/habits/hooks'
import type { Habit } from '../../features/habits/api'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function HabitRow({ habit }: { habit: Habit }) {
  const log = useLogEntry()

  function toggle() {
    log.mutate({
      habitId: habit.id,
      date: todayIso(),
      completedCount: habit.completedToday ? 0 : 1,
    })
  }

  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      {/* Color dot + icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: habit.color + '33', color: habit.color }}
      >
        {habit.icon ?? '✓'}
      </div>

      {/* Name + streak */}
      <Link to={`/habits/${habit.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-100">{habit.name}</p>
        {habit.streak > 0 && (
          <p className="flex items-center gap-1 text-xs text-orange-400">
            <Flame size={12} />
            {habit.streak} Tag{habit.streak !== 1 ? 'e' : ''}
          </p>
        )}
      </Link>

      {/* Toggle button */}
      <button
        onClick={toggle}
        disabled={log.isPending}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
          habit.completedToday
            ? 'bg-indigo-600 text-white'
            : 'border border-zinc-700 text-zinc-600 hover:border-indigo-500 hover:text-indigo-400'
        }`}
      >
        <Check size={18} />
      </button>
    </Card>
  )
}

export function HabitsListPage() {
  const { data: habits, isLoading } = useHabits()

  return (
    <div>
      <PageHeader
        title="Habits"
        action={
          <Link to="/habits/new" className="text-indigo-400 hover:text-indigo-300">
            <Plus size={24} />
          </Link>
        }
      />

      <div className="space-y-2 p-4">
        {isLoading && (
          <p className="text-center text-zinc-500 text-sm py-8">Laden…</p>
        )}

        {!isLoading && habits?.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-zinc-400">Noch keine Habits.</p>
            <Link
              to="/habits/new"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Ersten Habit erstellen
            </Link>
          </div>
        )}

        {habits?.map(habit => <HabitRow key={habit.id} habit={habit} />)}
      </div>
    </div>
  )
}
