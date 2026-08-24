import { useState } from 'react'
import { Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWeight, useUpsertWeight } from '../../../features/weight/hooks'
import type { WeightEntry } from '../../../features/weight/api'
import { MetricChart } from '../../../components/charts/MetricChart'
import { Section, SaveStatus } from './Section'
import { useAutosave } from '../../../lib/useAutosave'

function numOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function BodyForm({ date, entry }: { date: string; entry?: WeightEntry }) {
  const { t } = useTranslation()
  const upsert = useUpsertWeight()

  const [weight, setWeight] = useState(entry?.weightKg == null ? '' : String(entry.weightKg))
  const [waist, setWaist] = useState(entry?.waistCm == null ? '' : String(entry.waistCm))
  const [notes, setNotes] = useState(entry?.notes ?? '')

  const weightKg = numOrNull(weight)
  const waistCm = numOrNull(waist)

  // An untouched empty day has nothing to write; the entry is only created
  // once a number is actually in it.
  useAutosave(
    { date, weightKg, waistCm, notes: notes || undefined },
    values => upsert.mutate(values),
    { enabled: weightKg != null || waistCm != null },
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-gray-400 dark:text-zinc-500">{t('weight.weightKg')}</span>
          <div className="flex items-baseline gap-1 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2.5">
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={20}
              max={400}
              placeholder="–"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              className="w-full min-w-0 bg-transparent text-base font-semibold text-gray-900 dark:text-white outline-none"
            />
            <span className="text-xs text-gray-400 dark:text-zinc-500">kg</span>
          </div>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-gray-400 dark:text-zinc-500">{t('weight.waistCm')}</span>
          <div className="flex items-baseline gap-1 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2.5">
            <input
              type="number"
              inputMode="decimal"
              step={0.5}
              min={30}
              max={250}
              placeholder="–"
              value={waist}
              onChange={e => setWaist(e.target.value)}
              className="w-full min-w-0 bg-transparent text-base font-semibold text-gray-900 dark:text-white outline-none"
            />
            <span className="text-xs text-gray-400 dark:text-zinc-500">cm</span>
          </div>
        </label>
      </div>

      <input
        type="text"
        placeholder={t('weight.notePlaceholder')}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <SaveStatus
        pending={upsert.isPending}
        savedAt={upsert.isSuccess ? upsert.submittedAt : undefined}
        error={upsert.error}
      />
    </div>
  )
}

export function WeightSection({ date }: { date: string }) {
  const { t } = useTranslation()
  const { data: entries = [], isLoading } = useWeight(180)
  const entry = entries.find(e => e.date === date)

  const summary = [
    entry?.weightKg != null ? `${entry.weightKg} kg` : null,
    entry?.waistCm != null ? `${entry.waistCm} cm` : null,
  ].filter(Boolean).join(' · ')

  const chronological = [...entries].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Section title={t('weight.title')} icon={<Scale size={15} />} summary={summary || undefined}>
      <div className="space-y-3">
        {isLoading
          ? <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">{t('common.loading')}</p>
          : <BodyForm key={date} date={date} entry={entry} />}
        {chronological.length > 1 && (
          <MetricChart
            series={[
              { label: t('weight.weightKg'), color: '#6366f1', unit: ' kg', averageOver: 7, points: chronological.map(e => ({ date: e.date, value: e.weightKg })) },
              { label: t('weight.waistCm'), color: '#f59e0b', unit: ' cm', points: chronological.map(e => ({ date: e.date, value: e.waistCm })) },
            ]}
          />
        )}
      </div>
    </Section>
  )
}
