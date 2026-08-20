import { useState } from 'react'
import { Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWeight, useUpsertWeight } from '../../../features/weight/hooks'
import type { WeightEntry } from '../../../features/weight/api'
import { WeightChart } from '../../../components/charts/WeightChart'
import { Section, SaveButton } from './Section'

function WeightForm({ date, entry }: { date: string; entry?: WeightEntry }) {
  const { t } = useTranslation()
  const upsert = useUpsertWeight()

  const [weight, setWeight] = useState(entry ? String(entry.weightKg) : '')
  const [notes, setNotes] = useState(entry?.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const kg = parseFloat(weight.replace(',', '.'))
    if (!kg || kg <= 0) return
    upsert.mutate({ date, weightKg: kg, notes: notes || undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-baseline gap-2 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2.5">
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={20}
          max={300}
          placeholder="–"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          className="w-full min-w-0 bg-transparent text-base font-semibold text-gray-900 dark:text-white outline-none"
        />
        <span className="text-xs text-gray-400 dark:text-zinc-500">kg</span>
      </div>

      <input
        type="text"
        placeholder={t('weight.notePlaceholder')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <SaveButton pending={upsert.isPending} disabled={!weight} label={t('common.save')} />
    </form>
  )
}

export function WeightSection({ date }: { date: string }) {
  const { t } = useTranslation()
  const { data: entries = [], isLoading } = useWeight(180)
  const entry = entries.find(e => e.date === date)

  return (
    <Section
      title={t('weight.title')}
      icon={<Scale size={15} />}
      summary={entry ? `${entry.weightKg} kg` : undefined}
    >
      <div className="space-y-3">
        {isLoading
          ? <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">{t('common.loading')}</p>
          : <WeightForm key={`${date}:${entry?.id ?? 'new'}`} date={date} entry={entry} />}
        <WeightChart entries={entries} />
      </div>
    </Section>
  )
}
