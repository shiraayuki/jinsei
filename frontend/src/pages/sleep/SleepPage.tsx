import { useState } from 'react'
import { Trash2, Moon, Sun } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useSleep, useUpsertSleep, useDeleteSleep } from '../../features/sleep/hooks'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import type { SleepEntry } from '../../features/sleep/api'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const QUALITY_COLORS = ['', 'text-rose-400', 'text-orange-400', 'text-yellow-400', 'text-emerald-400', 'text-indigo-400']

function parseBedMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  const mins = h * 60 + m
  // Normalize: times before 6am belong to "next day" cycle
  return mins < 360 ? mins + 1440 : mins
}

const QUALITY_COLORS_BG = ['', 'bg-rose-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-indigo-400']

function SleepStats({ entries }: { entries: SleepEntry[] }) {
  const { t } = useTranslation()
  if (entries.length === 0) return null

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const avgDuration = Math.round(entries.reduce((s, e) => s + e.durationMinutes, 0) / entries.length)
  const avgQuality = (entries.reduce((s, e) => s + e.quality, 0) / entries.length).toFixed(1)
  const latest = entries[0]

  const bedMins = entries.map(e => parseBedMinutes(e.bedTime))
  const meanBed = bedMins.reduce((s, v) => s + v, 0) / bedMins.length
  const stdevBed = Math.round(Math.sqrt(bedMins.reduce((s, v) => s + (v - meanBed) ** 2, 0) / bedMins.length))
  const consistencyLabel = stdevBed <= 15 ? t('sleep.consistency.veryConsistent') : stdevBed <= 30 ? t('sleep.consistency.consistent') : stdevBed <= 60 ? t('sleep.consistency.variable') : t('sleep.consistency.irregular')

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <Moon size={16} className="mx-auto mb-1 text-indigo-400" />
          <div className="text-lg font-bold text-gray-900 dark:text-white">{formatDuration(latest.durationMinutes)}</div>
          <div className="text-xs text-gray-400 dark:text-zinc-500">{t('sleep.lastNight')}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">{formatDuration(avgDuration)}</div>
          <div className="text-xs text-gray-400 dark:text-zinc-500">{t('sleep.avgDuration')}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">{avgQuality}</div>
          <div className="text-xs text-gray-400 dark:text-zinc-500">{t('sleep.avgQuality')}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <div className="text-sm font-bold text-gray-900 dark:text-white">±{stdevBed}min</div>
          <div className="text-xs text-gray-400 dark:text-zinc-500">{consistencyLabel}</div>
        </div>
      </div>

      {/* Quality trend chart */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
        <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-zinc-400">{t('sleep.qualityChart')}</p>
        <div className="flex items-end gap-0.5" style={{ height: 48 }}>
          {sorted.map(e => (
            <div
              key={e.id}
              className={`flex-1 rounded-t-sm ${QUALITY_COLORS_BG[e.quality]}`}
              style={{ height: (e.quality / 5) * 40 + 4 }}
              title={`${formatDate(e.date)}: ${QUALITY_LABELS[e.quality]}`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-gray-400 dark:text-zinc-600">
          <span>{formatDate(sorted[0].date)}</span>
          <span>{formatDate(sorted[sorted.length - 1].date)}</span>
        </div>
      </div>
    </div>
  )
}

export function SleepPage() {
  const { data: entries = [] } = useSleep(30)
  const upsert = useUpsertSleep()
  const del = useDeleteSleep()
  const { t } = useTranslation()
  const qualityLabels = t('sleep.qualityLabels', { returnObjects: true }) as string[]

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
      <PageHeader title={t('sleep.title')} />

      <SleepStats entries={entries} />

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white dark:bg-zinc-900 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-zinc-300">{t('sleep.log')}</h2>

        <div>
          <label className="mb-1 block text-xs text-gray-400 dark:text-zinc-500">{t('sleep.wakeDay')}</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500">
              <Moon size={11} /> {t('sleep.bedtime')}
            </label>
            <input
              type="time"
              value={bedTime}
              onChange={e => setBedTime(e.target.value)}
              className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500">
              <Sun size={11} /> {t('sleep.wakeTime')}
            </label>
            <input
              type="time"
              value={wakeTime}
              onChange={e => setWakeTime(e.target.value)}
              className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="text-center text-sm text-gray-500 dark:text-zinc-400">
          {t('sleep.duration')}: <span className="font-semibold text-gray-900 dark:text-white">{formatDuration(previewDuration)}</span>
        </div>

        <div>
          <label className="mb-2 block text-xs text-gray-400 dark:text-zinc-500">{t('sleep.quality')}</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setQuality(q)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  quality === q
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:bg-zinc-700'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-1 text-center text-xs text-gray-400 dark:text-zinc-500">{qualityLabels[quality]}</p>
        </div>

        <input
          type="text"
          placeholder={t('weight.notePlaceholder')}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="submit"
          disabled={upsert.isPending}
          className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {t('common.save')}
        </button>
      </form>

      {entries.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-zinc-400">{t('common.history')}</h2>
          {entries.map(entry => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl bg-white dark:bg-zinc-900 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatDuration(entry.durationMinutes)}</span>
                  <span className={`text-xs font-medium ${QUALITY_COLORS[entry.quality]}`}>{qualityLabels[entry.quality]}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-zinc-500">{entry.bedTime} → {entry.wakeTime}</p>
                {entry.notes && <p className="text-xs text-gray-400 dark:text-zinc-600">{entry.notes}</p>}
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
