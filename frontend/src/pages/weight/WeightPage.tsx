import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useWeight, useUpsertWeight, useDeleteWeight } from '../../features/weight/hooks'
import type { WeightEntry } from '../../features/weight/api'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function movingAvg(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
}

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return null

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const values = sorted.map(e => e.weightKg)
  const maValues = movingAvg(values, 7)

  const allVals = [...values, ...maValues]
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const range = max - min || 1

  const W = 300
  const H = 80
  const PAD = 8

  const toPoint = (val: number, i: number) => {
    const x = PAD + (i / (sorted.length - 1)) * (W - PAD * 2)
    const y = PAD + ((max - val) / range) * (H - PAD * 2)
    return `${x},${y}`
  }

  const rawPoints = sorted.map((e, i) => toPoint(e.weightKg, i))
  const maPoints = maValues.map((v, i) => toPoint(v, i))

  const latest = sorted[sorted.length - 1]
  const totalChange = latest.weightKg - sorted[0].weightKg
  const daySpan = (new Date(latest.date).getTime() - new Date(sorted[0].date).getTime()) / 86400000
  const weeklyRate = daySpan > 0 ? (totalChange / daySpan) * 7 : 0

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {latest.weightKg} <span className="text-sm font-normal text-gray-500 dark:text-zinc-400">kg</span>
        </span>
        <div className="text-right">
          <p className={`text-sm font-medium ${totalChange > 0 ? 'text-rose-400' : totalChange < 0 ? 'text-emerald-400' : 'text-gray-400 dark:text-zinc-500'}`}>
            {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)} kg gesamt
          </p>
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            {weeklyRate > 0 ? '+' : ''}{weeklyRate.toFixed(2)} kg/Woche
          </p>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {/* Raw data — faint */}
        <polyline
          points={rawPoints.join(' ')}
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeOpacity="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 7-point moving average */}
        <polyline
          points={maPoints.join(' ')}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {sorted.map((e, i) => {
          const [x, y] = rawPoints[i].split(',').map(Number)
          return <circle key={e.id} cx={x} cy={y} r="2.5" fill="#6366f1" fillOpacity="0.4" />
        })}
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400 dark:text-zinc-600">
        <span>{formatDate(sorted[0].date)}</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded bg-indigo-500" />7T MA
        </span>
        <span>{formatDate(latest.date)}</span>
      </div>
    </div>
  )
}

export function WeightPage() {
  const { data: entries = [] } = useWeight(90)
  const upsert = useUpsertWeight()
  const del = useDeleteWeight()

  const [date, setDate] = useState(todayIso())
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const kg = parseFloat(weight)
    if (!kg || kg <= 0) return
    upsert.mutate({ date, weightKg: kg, notes: notes || undefined }, {
      onSuccess: () => { setWeight(''); setNotes('') },
    })
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <PageHeader title="Gewicht" />

      <WeightChart entries={entries} />

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white dark:bg-zinc-900 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-zinc-300">Eintragen</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400 dark:text-zinc-500">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400 dark:text-zinc-500">Gewicht (kg)</label>
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              placeholder="75.0"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <input
          type="text"
          placeholder="Notiz (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={upsert.isPending || !weight}
          className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          Speichern
        </button>
      </form>

      {entries.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-zinc-400">Verlauf</h2>
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl bg-white dark:bg-zinc-900 px-4 py-3">
              <div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{entry.weightKg} kg</span>
                {entry.notes && <p className="text-xs text-gray-400 dark:text-zinc-500">{entry.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-zinc-500">{formatDate(entry.date)}</span>
                <button
                  onClick={() => del.mutate(entry.id)}
                  className="text-gray-400 dark:text-zinc-600 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
