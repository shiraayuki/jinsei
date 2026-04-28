import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Flame, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { useHabits, useHabitEntries, useLogEntry, useArchiveHabit } from '../../features/habits/hooks'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function last90Days() {
  const days: string[] = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(isoDate(d))
  }
  return days
}

export function HabitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: habits } = useHabits()
  const habit = habits?.find(h => h.id === id)

  const today = isoDate(new Date())
  const fromDate = isoDate(new Date(Date.now() - 89 * 86400000))
  const { data: entries } = useHabitEntries(id!, fromDate, today)

  const log = useLogEntry()
  const archive = useArchiveHabit()

  const completedDates = useMemo(
    () => new Set(entries?.filter(e => e.completedCount > 0).map(e => e.date) ?? []),
    [entries],
  )

  const days = useMemo(() => last90Days(), [])

  async function handleArchive() {
    if (!id) return
    if (!confirm('Habit archivieren?')) return
    await archive.mutateAsync(id)
    navigate('/habits')
  }

  function toggleDay(date: string) {
    if (!id) return
    const completed = completedDates.has(date)
    log.mutate({ habitId: id, date, completedCount: completed ? 0 : 1 })
  }

  if (!habit) {
    return (
      <div>
        <PageHeader title="Habit" back />
        <p className="p-4 text-zinc-500">Nicht gefunden.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={habit.name}
        back
        action={
          <Link to={`/habits/${id}/edit`} className="text-zinc-400 hover:text-zinc-200">
            <Pencil size={18} />
          </Link>
        }
      />

      <div className="p-4 space-y-6">
        {/* Streak badge */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{ backgroundColor: habit.color + '22', color: habit.color }}
          >
            {habit.icon ?? '✓'}
          </div>
          <div>
            <p className="text-lg font-semibold">{habit.name}</p>
            {habit.streak > 0 && (
              <p className="flex items-center gap-1 text-sm text-orange-400">
                <Flame size={14} />
                {habit.streak} Tag{habit.streak !== 1 ? 'e' : ''} Streak
              </p>
            )}
            {habit.description && <p className="text-sm text-zinc-500">{habit.description}</p>}
          </div>
        </div>

        {/* 90-day grid */}
        <div>
          <p className="mb-2 text-xs text-zinc-500">Letzte 90 Tage</p>
          <div className="grid grid-cols-13 gap-1" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}>
            {days.map(day => {
              const done = completedDates.has(day)
              const isToday = day === today
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  disabled={log.isPending}
                  title={day}
                  className={`aspect-square rounded-sm transition-colors ${
                    done
                      ? 'opacity-100'
                      : isToday
                        ? 'border border-dashed border-zinc-600 bg-transparent'
                        : 'bg-zinc-800'
                  }`}
                  style={done ? { backgroundColor: habit.color } : undefined}
                />
              )
            })}
          </div>
        </div>

        {/* Schedule info */}
        {habit.schedule && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-400">
            {habit.schedule.type === 'daily' && `Täglich, Ziel: ${habit.schedule.targetCount}×`}
            {habit.schedule.type === 'weekly' &&
              `Wöchentlich an: ${habit.schedule.daysOfWeek?.map(d => ['So','Mo','Di','Mi','Do','Fr','Sa'][d]).join(', ') ?? '–'}`}
            {habit.schedule.type === 'interval' &&
              `Alle ${habit.schedule.intervalDays} Tage`}
          </div>
        )}

        <Button variant="danger" className="w-full" onClick={handleArchive} loading={archive.isPending}>
          <Trash2 size={16} />
          Habit archivieren
        </Button>
      </div>
    </div>
  )
}
