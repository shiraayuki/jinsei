import { Link } from 'react-router-dom'
import { Plus, Flame, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useHabits, useLogEntry } from '../../features/habits/hooks'
import { useTranslation } from 'react-i18next'
import type { Habit } from '../../features/habits/api'
import { todayIso } from '../../lib/date'

function HabitRow({ habit }: { habit: Habit }) {
  const log = useLogEntry()
  const { t } = useTranslation()

  function toggle() {
    log.mutate({ habitId: habit.id, date: todayIso(), completedCount: habit.completedToday ? 0 : 1 })
  }

  return (
    <div
      className="card flex items-center gap-3 px-4 py-3.5 transition-colors"
      style={habit.completedToday
        ? { background: `color-mix(in srgb, ${habit.color} 10%, var(--surface))`, borderColor: `color-mix(in srgb, ${habit.color} 35%, transparent)` }
        : undefined}
    >
      <button
        onClick={toggle}
        disabled={log.isPending}
        aria-pressed={habit.completedToday}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border transition-colors"
        style={habit.completedToday
          ? { background: habit.color, borderColor: habit.color, color: 'white' }
          : { borderColor: 'var(--line-strong)', color: 'var(--ink-faint)' }}
      >
        <Check size={17} strokeWidth={1.75} />
      </button>

      <Link to={`/habits/${habit.id}`} className="flex min-w-0 flex-1 flex-col justify-center self-stretch py-1">
        <p className={`font-semibold transition-colors ${habit.completedToday ? 'text-ink-mute line-through' : 'text-ink'}`}>
          {habit.name}
        </p>
        {/* Below three days a flame is decoration, not a signal. */}
        {habit.streak >= 3 && (
          <p className="mt-0.5 flex items-center gap-1 text-meta text-warn tabular">
            <Flame size={11} />
            {t('habits.daysStreak', { count: habit.streak })}
          </p>
        )}
      </Link>


    </div>
  )
}

export function HabitsListPage() {
  const { data: habits, isLoading } = useHabits()
  const { t } = useTranslation()
  const active = habits?.filter(h => !h.archived) ?? []
  const done = active.filter(h => h.completedToday).length

  return (
    <div>
      <PageHeader
        title={t('habits.title')}
        action={
          <Link
            to="/habits/new"
            className="-mr-2 flex items-center gap-1 px-2 py-2 text-body font-medium text-accent active:opacity-50"
          >
            <Plus size={18} strokeWidth={2.2} />
            {t('common.new')}
          </Link>
        }
      />

      <div className="px-4 pt-2 pb-8 space-y-2">
        {active.length > 0 && (
          <div className="flex items-center justify-between px-1 pb-1">
            <p className="text-body text-ink-mute">
              <span className="font-semibold text-ink-soft">{done}</span>/{active.length} {t('habits.today')}
            </p>
            {done === active.length && active.length > 0 && (
              <p className="text-meta font-medium text-accent">{t('habits.allDone')}</p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-card bg-raised animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && active.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="font-medium text-ink-mute">Noch keine Habits</p>
            <p className="text-body text-ink-faint">Starte mit einer kleinen täglichen Gewohnheit.</p>
            <Link
              to="/habits/new"
              className="mt-2 rounded-control bg-accent px-5 py-2.5 text-body font-semibold text-white shadow-md hover:brightness-110"
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
