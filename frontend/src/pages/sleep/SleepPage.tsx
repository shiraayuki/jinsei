import { useState } from 'react'
import { Trash2, Moon, Bed } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useSleep, useUpsertSleep, useDeleteSleep } from '../../features/sleep/hooks'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import type { SleepEntry } from '../../features/sleep/api'
import { DurationField } from '../../components/ui/DurationField'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return '–'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function qualityColor(quality: number | null) {
  if (quality == null) return 'bg-gray-300 dark:bg-zinc-700'
  if (quality >= 85) return 'bg-indigo-400'
  if (quality >= 70) return 'bg-emerald-400'
  if (quality >= 55) return 'bg-yellow-400'
  if (quality >= 40) return 'bg-orange-400'
  return 'bg-rose-400'
}

function SleepStats({ entries }: { entries: SleepEntry[] }) {
  const { t } = useTranslation()
  if (entries.length === 0) return null

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = entries[0]

  const withSleep = entries.filter(e => e.actualSleepMinutes != null)
  const avgSleep = withSleep.length
    ? Math.round(withSleep.reduce((s, e) => s + e.actualSleepMinutes!, 0) / withSleep.length)
    : null

  const withQuality = entries.filter(e => e.quality != null)
  const avgQuality = withQuality.length
    ? Math.round(withQuality.reduce((s, e) => s + e.quality!, 0) / withQuality.length)
    : null

  const withEfficiency = entries.filter(e => e.efficiency != null)
  const avgEfficiency = withEfficiency.length
    ? Math.round(withEfficiency.reduce((s, e) => s + e.efficiency!, 0) / withEfficiency.length)
    : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <Moon size={16} className="mx-auto mb-1 text-indigo-400" />
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {formatDuration(latest.actualSleepMinutes ?? latest.timeInBedMinutes)}
          </div>
          <div className="text-xs text-gray-400 dark:text-zinc-500">{t('sleep.lastNight')}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">{formatDuration(avgSleep)}</div>
          <div className="text-xs text-gray-400 dark:text-zinc-500">{t('sleep.avgDuration')}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {avgQuality != null ? `${avgQuality}%` : '–'}
          </div>
          <div className="text-xs text-gray-400 dark:text-zinc-500">{t('sleep.avgQuality')}</div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {avgEfficiency != null ? `${avgEfficiency}%` : '–'}
          </div>
          <div className="text-xs text-gray-400 dark:text-zinc-500">{t('sleep.avgEfficiency')}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
        <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-zinc-400">{t('sleep.qualityChart')}</p>
        <div className="flex items-end gap-0.5" style={{ height: 48 }}>
          {sorted.map(e => (
            <div
              key={e.id}
              className={`flex-1 rounded-t-sm ${qualityColor(e.quality)}`}
              style={{ height: ((e.quality ?? 0) / 100) * 40 + 4 }}
              title={`${formatDate(e.date)}: ${e.quality ?? '–'}%`}
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

/**
 * Split out so the parent can remount it with a key when the selected day
 * changes: the fields are seeded from the entry once, which keeps the form from
 * having to sync itself in an effect.
 */
function SleepForm({ date, entry }: { date: string; entry?: SleepEntry }) {
  const { t } = useTranslation()
  const upsert = useUpsertSleep()

  const [inBed, setInBed] = useState<number | null>(entry?.timeInBedMinutes ?? null)
  const [asleep, setAsleep] = useState<number | null>(entry?.actualSleepMinutes ?? null)
  const [quality, setQuality] = useState<number | null>(entry?.quality ?? null)
  const [notes, setNotes] = useState(entry?.notes ?? '')

  const efficiency = inBed && inBed > 0 && asleep != null
    ? Math.round((asleep / inBed) * 100)
    : null

  const tooMuchSleep = inBed != null && asleep != null && asleep > inBed

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tooMuchSleep) return
    upsert.mutate({
      date,
      timeInBedMinutes: inBed,
      actualSleepMinutes: asleep,
      quality,
      notes: notes || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DurationField
        label={t('sleep.timeInBed')}
        icon={<Bed size={13} />}
        minutes={inBed}
        onChange={setInBed}
      />

      <DurationField
        label={t('sleep.actualSleep')}
        icon={<Moon size={13} />}
        minutes={asleep}
        onChange={setAsleep}
      />

      {tooMuchSleep && (
        <p className="text-xs text-rose-500 dark:text-rose-400">{t('sleep.asleepExceedsBed')}</p>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label className="text-xs text-gray-400 dark:text-zinc-500">
            {t('sleep.quality')} <span className="text-gray-300 dark:text-zinc-600">Sleep Cycle</span>
          </label>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {quality != null ? `${quality}%` : '–'}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={quality ?? 0}
          onChange={e => setQuality(Number(e.target.value))}
          className="w-full accent-indigo-500"
          aria-label={t('sleep.quality')}
        />
      </div>

      {efficiency != null && (
        <p className="text-center text-sm text-gray-500 dark:text-zinc-400">
          {t('sleep.efficiency')}: <span className="font-semibold text-gray-900 dark:text-white">{efficiency}%</span>
        </p>
      )}

      <input
        type="text"
        placeholder={t('sleep.notePlaceholder')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <button
        type="submit"
        disabled={upsert.isPending || tooMuchSleep || (inBed == null && asleep == null && quality == null)}
        className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {t('common.save')}
      </button>
    </form>
  )
}

export function SleepPage() {
  const { data: entries = [] } = useSleep(180)
  const del = useDeleteSleep()
  const { t } = useTranslation()

  const [date, setDate] = useState(todayIso())
  const existing = entries.find(e => e.date === date)

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <PageHeader title={t('sleep.title')} />

      <SleepStats entries={entries} />

      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 space-y-4">
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

        <SleepForm key={`${date}:${existing?.id ?? 'new'}`} date={date} entry={existing} />
      </div>

      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 px-4 py-3">
            <div className={`h-8 w-1.5 shrink-0 rounded-full ${qualityColor(e.quality)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{formatDate(e.date)}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                {formatDuration(e.actualSleepMinutes)} {t('sleep.asleepShort')}
                {e.timeInBedMinutes != null && ` · ${formatDuration(e.timeInBedMinutes)} ${t('sleep.inBedShort')}`}
                {e.quality != null && ` · ${e.quality}%`}
              </p>
            </div>
            <button
              onClick={() => del.mutate(e.id)}
              aria-label={t('common.delete')}
              className="flex h-9 w-9 items-center justify-center text-gray-300 dark:text-zinc-700 hover:text-red-400 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
