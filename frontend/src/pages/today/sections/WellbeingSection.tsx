import { useState } from 'react'
import { Smile } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWellbeingDay, useUpsertWellbeing } from '../../../features/wellbeing/hooks'
import type { WellbeingEntry } from '../../../features/wellbeing/api'
import { Section, SaveStatus } from './Section'
import { useAutosave } from '../../../lib/useAutosave'

function Scale({ label, value, onChange }: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-meta text-ink-mute">{label}</label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            // Tapping the active value clears it, so a day can stay unanswered.
            onClick={() => onChange(value === n ? null : n)}
            className={`h-10 flex-1 rounded-control text-body font-semibold transition-colors ${
              value === n
                ? 'bg-accent text-white'
                : 'bg-raised text-ink-soft hover:bg-line'
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

  useAutosave(
    { date, hunger, energy, notes: notes || null },
    values => upsert.mutate(values),
  )

  return (
    <div className="space-y-4">
      <Scale label={t('wellbeing.hunger')} value={hunger} onChange={setHunger} />
      <Scale label={t('wellbeing.energy')} value={energy} onChange={setEnergy} />

      <textarea
        rows={3}
        placeholder={t('wellbeing.notePlaceholder')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full resize-none rounded-control bg-raised px-3 py-2 text-body text-ink outline-none focus:ring-2 focus:ring-accent"
      />

      <SaveStatus
        pending={upsert.isPending}
        savedAt={upsert.isSuccess ? upsert.submittedAt : undefined}
        error={upsert.error}
      />
    </div>
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
    <Section module="mind" title={t('wellbeing.title')} icon={<Smile size={15} />} summary={summary || undefined}>
      {isLoading
        ? <p className="py-4 text-center text-body text-ink-mute">{t('common.loading')}</p>
        : <WellbeingForm key={date} date={date} entry={entry} />}
    </Section>
  )
}
