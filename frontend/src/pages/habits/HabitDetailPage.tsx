import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Flame, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { useHabits, useHabitEntries, useLogEntry, useArchiveHabit, useHabitStats } from '../../features/habits/hooks'
import type { HabitStats } from '../../features/habits/api'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function HabitStatsSection({ stats, color }: { stats: HabitStats; color: string }) {
  const maxWeekday = Math.max(...stats.weekdayCounts, 1)
  const maxWeekly = Math.max(...stats.completionByWeek.map(w => w.completedCount), 1)

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-3 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.compliancePercent}%</p>
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">Einhaltung</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-3 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.longestStreak}</p>
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">Längster Streak</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-3 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.completedCount}</p>
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">Mal erledigt</p>
        </div>
      </div>

      {/* Weekday pattern */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
        <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-zinc-400">Wochentag-Muster</p>
        <div className="flex items-end gap-1.5" style={{ height: 56 }}>
          {stats.weekdayCounts.map((count, i) => {
            const barH = Math.max((count / maxWeekday) * 44, count > 0 ? 4 : 0)
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{ height: barH, backgroundColor: count > 0 ? color : undefined }}
                  aria-hidden
                />
                {count === 0 && (
                  <div className="w-full rounded-t-sm bg-gray-100 dark:bg-zinc-800" style={{ height: 4 }} />
                )}
                <span className="text-[10px] text-gray-400 dark:text-zinc-600">{WEEKDAY_LABELS[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly history */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
        <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-zinc-400">Wöchentlicher Verlauf</p>
        <div className="flex items-end gap-0.5" style={{ height: 48 }}>
          {stats.completionByWeek.map(w => {
            const barH = Math.max((w.completedCount / maxWeekly) * 36, w.completedCount > 0 ? 3 : 0)
            return (
              <div
                key={w.weekStart}
                className="flex-1 rounded-t-sm"
                style={{
                  height: barH || 3,
                  backgroundColor: w.completedCount > 0 ? color : undefined,
                }}
                title={`KW ${new Date(w.weekStart + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}: ${w.completedCount}×`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
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
  const { data: stats } = useHabitStats(id!)

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
        <p className="p-4 text-gray-400 dark:text-zinc-500">Nicht gefunden.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={habit.name}
        back
        action={
          <Link to={`/habits/${id}/edit`} className="text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:text-zinc-200">
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
            {habit.description && <p className="text-sm text-gray-400 dark:text-zinc-500">{habit.description}</p>}
          </div>
        </div>

        {/* 90-day grid */}
        <div>
          <p className="mb-2 text-xs text-gray-400 dark:text-zinc-500">Letzte 90 Tage</p>
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
                        ? 'border border-dashed border-gray-300 dark:border-zinc-600 bg-transparent'
                        : 'bg-gray-100 dark:bg-zinc-800'
                  }`}
                  style={done ? { backgroundColor: habit.color } : undefined}
                />
              )
            })}
          </div>
        </div>

        {/* Stats */}
        {stats && <HabitStatsSection stats={stats} color={habit.color} />}

        {/* Schedule info */}
        {habit.schedule && (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-sm text-gray-500 dark:text-zinc-400">
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
