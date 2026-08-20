import { useState } from 'react'
import { Smile } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWellbeingDay, useUpsertWellbeing } from '../../../features/wellbeing/hooks'
import type { WellbeingEntry } from '../../../features/wellbeing/api'
import { Section, SaveButton } from './Section'

function Scale({ label, value, onChange }: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400 dark:text-zinc-500">{label}</label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            // Tapping the active value clears it, so a day can stay unanswered.
            onClick={() => onChange(value === n ? null : n)}
            className={`h-10 flex-1 rounded-xl text-sm font-semibold transition-colors ${
              value === n
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function WellbeingForm({ date, entry }: { date: string; entry?: WellbeingEntry }) {
  const { t } = useTranslation()
  const upsert = useUpsertWellbeing()

  const [hunger, setHunger] = useState<number | null>(entry?.hunger ?? null)
  const [energy, setEnergy] = useState<number | null>(entry?.energy ?? null)
  const [notes, setNotes] = useState(entry?.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    upsert.mutate({ date, hunger, energy, notes: notes || null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Scale label={t('wellbeing.hunger')} value={hunger} onChange={setHunger} />
      <Scale label={t('wellbeing.energy')} value={energy} onChange={setEnergy} />

      <textarea
        rows={3}
        placeholder={t('wellbeing.notePlaceholder')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full resize-none rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <SaveButton
        pending={upsert.isPending}
        disabled={hunger == null && energy == null && !notes}
        label={t('common.save')}
      />
    </form>
  )
}

export function WellbeingSection({ date }: { date: string }) {
  const { t } = useTranslation()
  const { data: entry, isLoading } = useWellbeingDay(date)

  const summary = [
    entry?.hunger != null ? `${t('wellbeing.hungerShort')} ${entry.hunger}` : null,
    entry?.energy != null ? `${t('wellbeing.energyShort')} ${entry.energy}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Section title={t('wellbeing.title')} icon={<Smile size={15} />} summary={summary || undefined}>
      {isLoading
        ? <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">{t('common.loading')}</p>
        : <WellbeingForm key={`${date}:${entry?.id ?? 'new'}`} date={date} entry={entry} />}
    </Section>
  )
}
