import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Flame, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { useHabits, useHabitEntries, useLogEntry, useArchiveHabit, useHabitStats } from '../../features/habits/hooks'
import type { HabitStats } from '../../features/habits/api'
import { shiftIso, toIsoDate } from '../../lib/date'

function isoDate(d: Date) {
  return toIsoDate(d)
}

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function HabitStatsSection({ stats, color }: { stats: HabitStats; color: string }) {
  const maxWeekday = Math.max(...stats.weekdayCounts, 1)
  const maxWeekly = Math.max(...stats.completionByWeek.map(w => w.completedCount), 1)

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="font-display text-value font-semibold text-ink tabular">{stats.compliancePercent}%</p>
          <p className="text-meta text-ink-mute">Einhaltung</p>
        </div>
        <div className="card p-3 text-center">
          <p className="font-display text-value font-semibold text-ink tabular">{stats.longestStreak}</p>
          <p className="text-meta text-ink-mute">Längster Streak</p>
        </div>
        <div className="card p-3 text-center">
          <p className="font-display text-value font-semibold text-ink tabular">{stats.completedCount}</p>
          <p className="text-meta text-ink-mute">Mal erledigt</p>
        </div>
      </div>

      {/* Weekday pattern */}
      <div className="card p-4">
        <p className="mb-3 text-meta font-semibold text-ink-mute">Wochentag-Muster</p>
        <div className="flex items-end gap-1.5" style={{ height: 56 }}>
          {stats.weekdayCounts.map((count, i) => {
            const barH = Math.max((count / maxWeekday) * 44, count > 0 ? 4 : 0)
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-[3px] transition-all"
                  style={{ height: barH, backgroundColor: count > 0 ? color : undefined }}
                  aria-hidden
                />
                {count === 0 && (
                  <div className="w-full rounded-t-[3px] bg-raised" style={{ height: 4 }} />
                )}
                <span className="text-label text-ink-faint">{WEEKDAY_LABELS[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly history */}
      <div className="card p-4">
        <p className="mb-3 text-meta font-semibold text-ink-mute">Wöchentlicher Verlauf</p>
        <div className="flex items-end gap-0.5" style={{ height: 48 }}>
          {stats.completionByWeek.map(w => {
            const barH = Math.max((w.completedCount / maxWeekly) * 36, w.completedCount > 0 ? 3 : 0)
            return (
              <div
                key={w.weekStart}
                className="flex-1 rounded-t-[3px]"
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
  // Derived from the day itself rather than a timestamp: reading the clock
  // twice in one render can straddle midnight, and a raw millisecond offset
  // ignores daylight saving.
  const fromDate = shiftIso(today, -89)
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
        <p className="p-4 text-ink-mute">Nicht gefunden.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={habit.name}
        back
        action={
          <Link to={`/habits/${id}/edit`} className="text-ink-mute hover:text-ink-soft">
            <Pencil size={18} />
          </Link>
        }
      />

      <div className="p-4 space-y-6">
        {/* Streak badge */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-card text-head"
            style={{ backgroundColor: habit.color + '22', color: habit.color }}
          >
            {habit.icon ?? '✓'}
          </div>
          <div>
            <p className="text-value font-semibold">{habit.name}</p>
            {habit.streak > 0 && (
              <p className="flex items-center gap-1 text-body text-warn">
                <Flame size={14} />
                {habit.streak} Tag{habit.streak !== 1 ? 'e' : ''} Streak
              </p>
            )}
            {habit.description && <p className="text-body text-ink-mute">{habit.description}</p>}
          </div>
        </div>

        {/* 90-day grid */}
        <div>
          <p className="mb-2 text-meta text-ink-mute">Letzte 90 Tage</p>
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
                  className={`aspect-square rounded-chip transition-colors ${
                    done
                      ? 'opacity-100'
                      : isToday
                        ? 'border border-dashed border-line-strong bg-transparent'
                        : 'bg-raised'
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
          <div className="rounded-control border border-line bg-surface p-3 text-body text-ink-mute">
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
