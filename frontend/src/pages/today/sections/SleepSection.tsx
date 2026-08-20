import { useState } from 'react'
import { Moon, Bed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSleep, useUpsertSleep } from '../../../features/sleep/hooks'
import type { SleepEntry } from '../../../features/sleep/api'
import { DurationField } from '../../../components/ui/DurationField'
import { Section, SaveButton } from './Section'

function formatDuration(minutes: number | null) {
  if (minutes == null) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
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

      <SaveButton
        pending={upsert.isPending}
        disabled={tooMuchSleep || (inBed == null && asleep == null && quality == null)}
        label={t('common.save')}
      />
    </form>
  )
}

export function SleepSection({ date }: { date: string }) {
  const { t } = useTranslation()
  const { data: entries = [], isLoading } = useSleep(180)
  const entry = entries.find(e => e.date === date)

  const summary = entry
    ? [formatDuration(entry.actualSleepMinutes ?? entry.timeInBedMinutes), entry.quality != null ? `${entry.quality}%` : null]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <Section title={t('sleep.title')} icon={<Moon size={15} />} summary={summary || undefined}>
      {isLoading
        ? <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">{t('common.loading')}</p>
        : <SleepForm key={`${date}:${entry?.id ?? 'new'}`} date={date} entry={entry} />}
    </Section>
  )
}
