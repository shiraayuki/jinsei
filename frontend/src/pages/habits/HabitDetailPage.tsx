import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Flame, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { useHabits, useHabitEntries, useLogEntry, useArchiveHabit, useHabitStats } from '../../features/habits/hooks'
import type { HabitStats } from '../../features/habits/api'
import { shiftIso, toIsoDate } from '../../lib/date'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { Card } from '../../components/ui/Card'
import { Chart } from '../../components/charts/Chart'
import { BarRow } from '../../components/charts/BarRow'
import { StatTile } from '../../components/charts/StatTile'

function isoDate(d: Date) {
  return toIsoDate(d)
}

/**
 * Weekday initials in the app's language rather than a hardcoded German list.
 * The backend counts by `DayOfWeek`, so index 0 is Sunday and stays that way.
 */
function weekdayLabels(): string[] {
  const format = new Intl.DateTimeFormat(dateLocale(), { weekday: 'short' })
  // 2024-01-07 was a Sunday, which lines the array up with the backend's index.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2024, 0, 7 + i)))
}

function HabitStatsSection({ stats, color }: { stats: HabitStats; color: string }) {
  const { t } = useTranslation()
  const labels = weekdayLabels()
  const maxWeekday = Math.max(...stats.weekdayCounts, 1)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t('habits.compliance')} value={`${stats.compliancePercent}%`} />
        <StatTile label={t('habits.longestStreak')} value={String(stats.longestStreak)} />
        <StatTile label={t('habits.completed')} value={String(stats.completedCount)} />
      </div>

      <Card className="space-y-1.5 p-4">
        <p className="mb-2 text-meta font-semibold text-ink-mute">{t('habits.weekdayPattern')}</p>
        {stats.weekdayCounts.map((count, i) => (
          <BarRow
            key={labels[i]}
            label={labels[i]}
            value={count}
            max={maxWeekday}
            color={color}
            hint={`${count}×`}
          />
        ))}
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-meta font-semibold text-ink-mute">{t('habits.weeklyHistory')}</p>
        <Chart
          series={[
            {
              label: t('habits.weeklyHistory'),
              color,
              kind: 'bar',
              points: stats.completionByWeek.map(w => ({ date: w.weekStart, value: w.completedCount })),
            },
          ]}
          zeroBased
          height={84}
          format={v => String(Math.round(v))}
        />
      </Card>
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
  const { t } = useTranslation()
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
    if (!confirm(t('habits.archiveConfirm'))) return
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
        <PageHeader title={t('habits.title')} back />
        <p className="p-4 text-ink-mute">{t('habits.notFound')}</p>
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
                {t('habits.daysStreak', { count: habit.streak })}
              </p>
            )}
            {habit.description && <p className="text-body text-ink-mute">{habit.description}</p>}
          </div>
        </div>

        {/* 90-day grid */}
        <div>
          <p className="mb-2 text-meta text-ink-mute">{t('habits.last90days')}</p>
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
            {habit.schedule.type === 'daily' && t('habits.scheduleDaily', { count: habit.schedule.targetCount })}
            {habit.schedule.type === 'weekly' &&
              t('habits.scheduleWeekly', {
                days: habit.schedule.daysOfWeek?.map(d => weekdayLabels()[d]).join(', ') ?? '–',
              })}
            {habit.schedule.type === 'interval' &&
              t('habits.scheduleInterval', { days: habit.schedule.intervalDays })}
          </div>
        )}

        <Button variant="danger" className="w-full" onClick={handleArchive} loading={archive.isPending}>
          <Trash2 size={16} />
          {t('habits.archive')}
        </Button>
      </div>
    </div>
  )
}
