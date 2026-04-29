import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import {
  useWorkoutVolume,
  useWorkoutFrequency,
  usePersonalRecords,
  useExerciseProgression,
} from '../../features/stats/hooks'
import type { WeeklyVolume, ProgressionPoint } from '../../features/stats/api'

// ── Charts ────────────────────────────────────────────────────────────────

function VolumeBarChart({ data }: { data: WeeklyVolume[] }) {
  const max = Math.max(...data.map(d => d.totalVolumeKg), 1)
  const W = 300
  const H = 80
  const barCount = data.length
  const gap = 2
  const barW = (W - gap * (barCount - 1)) / barCount

  const formatWeek = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
      <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-zinc-200">Wöchentliches Volumen</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {data.map((d, i) => {
          const barH = Math.max((d.totalVolumeKg / max) * (H - 4), d.totalVolumeKg > 0 ? 2 : 0)
          const x = i * (barW + gap)
          const y = H - barH
          return (
            <rect
              key={d.weekStart}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx="2"
              className={d.totalVolumeKg > 0 ? 'fill-indigo-500' : 'fill-gray-100 dark:fill-zinc-800'}
            />
          )
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400 dark:text-zinc-600">
        <span>{data.length > 0 ? formatWeek(data[0].weekStart) : ''}</span>
        <span>{data.length > 0 ? formatWeek(data[data.length - 1].weekStart) : ''}</span>
      </div>
    </div>
  )
}

function ProgressionChart({ data }: { data: ProgressionPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">
        Zu wenig Daten für einen Verlauf.
      </p>
    )
  }

  const values = data.map(d => d.estimated1Rm)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const W = 300
  const H = 80
  const PAD = 8

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = PAD + ((max - d.estimated1Rm) / range) * (H - PAD * 2)
    return `${x},${y}`
  })

  const formatDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const [x, y] = points[i].split(',').map(Number)
          return <circle key={d.date} cx={x} cy={y} r="3" fill="#6366f1" />
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400 dark:text-zinc-600">
        <span>{formatDate(data[0].date)}</span>
        <span>{formatDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export function WorkoutStatsPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)

  const { data: volumeData = [], isLoading: loadingVolume } = useWorkoutVolume(12)
  const { data: freqData = [], isLoading: loadingFreq } = useWorkoutFrequency(12)
  const { data: prs = [], isLoading: loadingPrs } = usePersonalRecords()
  const { data: progression = [], isLoading: loadingProgression } = useExerciseProgression(
    selectedExerciseId,
    90
  )

  const activeWeeks = freqData.filter(w => w.workoutCount > 0).length || 1
  const avgWorkoutsPerWeek = (freqData.reduce((s, w) => s + w.workoutCount, 0) / activeWeeks).toFixed(1)
  const avgMinutesPerWeek = Math.round(freqData.reduce((s, w) => s + w.totalMinutes, 0) / activeWeeks)

  const totalVolume = Math.round(volumeData.reduce((s, w) => s + w.totalVolumeKg, 0))

  const formatDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: '2-digit' })

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
      <PageHeader title="Statistiken" />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgWorkoutsPerWeek}</p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">Trainings/Woche</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgMinutesPerWeek}</p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">Min/Woche</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{totalVolume.toLocaleString('de-DE')}</p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">kg Volumen</p>
        </div>
      </div>

      {/* Volume Chart */}
      {loadingVolume || loadingFreq ? (
        <div className="h-36 rounded-2xl bg-gray-100/50 dark:bg-zinc-800/50 animate-pulse" />
      ) : volumeData.length > 0 ? (
        <VolumeBarChart data={volumeData} />
      ) : null}

      {/* Personal Records */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
        <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-zinc-200">Bestleistungen</p>
        {loadingPrs ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-xl bg-gray-100/50 dark:bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        ) : prs.length === 0 ? (
          <p className="py-2 text-sm text-gray-400 dark:text-zinc-500">Noch keine Daten.</p>
        ) : (
          <div className="space-y-1">
            {prs.map(pr => (
              <div key={pr.exerciseId} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-zinc-100">{pr.exerciseName}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">
                    {pr.bestWeightKg} kg × {pr.bestReps} · {formatDate(pr.achievedAt)}
                  </p>
                </div>
                <div className="ml-3 text-right">
                  <p className="text-sm font-bold text-indigo-500">{pr.estimated1Rm.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500">1RM</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exercise Progression */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Übungsverlauf</p>
        <select
          value={selectedExerciseId ?? ''}
          onChange={e => setSelectedExerciseId(e.target.value || null)}
          className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Übung wählen…</option>
          {prs.map(pr => (
            <option key={pr.exerciseId} value={pr.exerciseId}>{pr.exerciseName}</option>
          ))}
        </select>

        {selectedExerciseId && (
          loadingProgression ? (
            <div className="h-20 rounded-xl bg-gray-100/50 dark:bg-zinc-800/50 animate-pulse" />
          ) : (
            <ProgressionChart data={progression} />
          )
        )}
      </div>
    </div>
  )
}
