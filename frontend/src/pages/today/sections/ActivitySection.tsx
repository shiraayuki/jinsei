import { useState } from 'react'
import { Footprints } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../../i18n'
import { useActivityDay, useUpsertActivity } from '../../../features/activity/hooks'
import { Section, SaveButton } from './Section'
import type { ActivityEntry } from '../../../features/activity/api'

function numOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function ActivityForm({ date, entry }: { date: string; entry?: ActivityEntry }) {
  const { t } = useTranslation()
  const upsert = useUpsertActivity()

  const [steps, setSteps] = useState(entry?.steps == null ? '' : String(entry.steps))
  const [cardio, setCardio] = useState(entry?.cardio ?? false)
  const [cardioMinutes, setCardioMinutes] = useState(
    entry?.cardioMinutes == null ? '' : String(entry.cardioMinutes),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    upsert.mutate({
      date,
      steps: numOrNull(steps),
      cardio,
      cardioMinutes: cardio ? numOrNull(cardioMinutes) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-gray-400 dark:text-zinc-500">{t('activity.steps')}</label>
        <div className="flex items-baseline gap-2 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2.5">
          <input
            type="number"
            inputMode="numeric"
            step={100}
            placeholder="–"
            value={steps}
            onChange={e => setSteps(e.target.value)}
            className="w-full min-w-0 bg-transparent text-base font-semibold text-gray-900 dark:text-white outline-none"
          />
          <span className="text-xs text-gray-400 dark:text-zinc-500">{t('activity.stepsUnit')}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400 dark:text-zinc-500">{t('activity.cardio')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={cardio}
          onClick={() => setCardio(v => !v)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
            cardio ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'
          }`}
        >
          <span
            className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white transition-transform ${
              cardio ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {cardio && (
        <div>
          <label className="mb-1 block text-xs text-gray-400 dark:text-zinc-500">{t('activity.cardioMinutes')}</label>
          <div className="flex items-baseline gap-2 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2">
            <input
              type="number"
              inputMode="numeric"
              step={5}
              placeholder="–"
              value={cardioMinutes}
              onChange={e => setCardioMinutes(e.target.value)}
              className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none"
            />
            <span className="text-xs text-gray-400 dark:text-zinc-500">min</span>
          </div>
        </div>
      )}

      <SaveButton pending={upsert.isPending} label={t('common.save')} />
    </form>
  )
}

export function ActivitySection({ date }: { date: string }) {
  const { t } = useTranslation()
  const { data: entry, isLoading } = useActivityDay(date)

  const summary = entry?.steps != null
    ? `${entry.steps.toLocaleString(dateLocale())} ${t('activity.stepsUnit')}`
    : entry?.cardio
      ? t('activity.cardio')
      : undefined

  return (
    <Section title={t('activity.title')} icon={<Footprints size={15} />} summary={summary}>
      {isLoading
        ? <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">{t('common.loading')}</p>
        : <ActivityForm key={`${date}:${entry?.id ?? 'new'}`} date={date} entry={entry} />}
    </Section>
  )
}
