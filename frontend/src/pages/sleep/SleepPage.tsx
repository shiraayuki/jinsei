import { useState } from 'react'
import { Trash2, Moon, Sun } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useSleep, useUpsertSleep, useDeleteSleep } from '../../features/sleep/hooks'
import type { SleepEntry } from '../../features/sleep/api'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const QUALITY_LABELS = ['', 'Schlecht', 'Mäßig', 'Ok', 'Gut', 'Super']
const QUALITY_COLORS = ['', 'text-rose-400', 'text-orange-400', 'text-yellow-400', 'text-emerald-400', 'text-indigo-400']

function SleepStats({ entries }: { entries: SleepEntry[] }) {
  if (entries.length === 0) return null

  const avgDuration = Math.round(entries.reduce((s, e) => s + e.durationMinutes, 0) / entries.length)
  const avgQuality = (entries.reduce((s, e) => s + e.quality, 0) / entries.length).toFixed(1)
  const latest = entries[0]

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-2xl bg-zinc-900 p-4 text-center">
        <Moon size={16} className="mx-auto mb-1 text-indigo-400" />
        <div className="text-lg font-bold text-white">{formatDuration(latest.durationMinutes)}</div>
        <div className="text-xs text-zinc-500">Letzte Nacht</div>
      </div>
      <div className="rounded-2xl bg-zinc-900 p-4 text-center">
        <div className="text-lg font-bold text-white">{formatDuration(avgDuration)}</div>
        <div className="text-xs text-zinc-500">Ø Dauer</div>
      </div>
      <div className="rounded-2xl bg-zinc-900 p-4 text-center">
        <div className="text-lg font-bold text-white">{avgQuality}</div>
        <div className="text-xs text-zinc-500">Ø Qualität</div>
      </div>
    </div>
  )
}

export function SleepPage() {
  const { data: entries = [] } = useSleep(30)
  const upsert = useUpsertSleep()
  const del = useDeleteSleep()

  const [date, setDate] = useState(todayIso())
  const [bedTime, setBedTime] = useState('23:00')
  const [wakeTime, setWakeTime] = useState('07:00')
  const [quality, setQuality] = useState(4)
  const [notes, setNotes] = useState('')

  function calcDuration() {
    const [bh, bm] = bedTime.split(':').map(Number)
    const [wh, wm] = wakeTime.split(':').map(Number)
    const bedMins = bh * 60 + bm
    const wakeMins = wh * 60 + wm
    const dur = wakeMins >= bedMins ? wakeMins - bedMins : 1440 - bedMins + wakeMins
    return dur
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    upsert.mutate({ date, bedTime, wakeTime, quality, notes: notes || undefined }, {
      onSuccess: () => setNotes(''),
    })
  }

  const previewDuration = calcDuration()

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <PageHeader title="Schlaf" />

      <SleepStats entries={entries} />

      <form onSubmit={handleSubmit} className="rounded-2xl bg-zinc-900 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">Eintragen</h2>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">Aufwachtag</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
              <Moon size={11} /> Einschlafen
            </label>
            <input
              type="time"
              value={bedTime}
              onChange={e => setBedTime(e.target.value)}
              className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
              <Sun size={11} /> Aufwachen
            </label>
            <input
              type="time"
              value={wakeTime}
              onChange={e => setWakeTime(e.target.value)}
              className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="text-center text-sm text-zinc-400">
          Schlafdauer: <span className="font-semibold text-white">{formatDuration(previewDuration)}</span>
        </div>

        <div>
          <label className="mb-2 block text-xs text-zinc-500">Schlafqualität</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  quality === q
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-1 text-center text-xs text-zinc-500">{QUALITY_LABELS[quality]}</p>
        </div>

        <input
          type="text"
          placeholder="Notiz (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="submit"
          disabled={upsert.isPending}
          className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          Speichern
        </button>
      </form>

      {entries.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400">Verlauf</h2>
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{formatDuration(entry.durationMinutes)}</span>
                  <span className={`text-xs font-medium ${QUALITY_COLORS[entry.quality]}`}>{QUALITY_LABELS[entry.quality]}</span>
                </div>
                <p className="text-xs text-zinc-500">{entry.bedTime} → {entry.wakeTime}</p>
                {entry.notes && <p className="text-xs text-zinc-600">{entry.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">{formatDate(entry.date)}</span>
                <button
                  onClick={() => del.mutate(entry.id)}
                  className="text-zinc-600 hover:text-rose-400 transition-colors"
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
