import { useState } from 'react'
import { Scale } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWeight, useUpsertWeight } from '../../../features/weight/hooks'
import type { WeightEntry } from '../../../features/weight/api'
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

  const weightKg = numOrNull(weight)
  const waistCm = numOrNull(waist)

  // An untouched empty day has nothing to write; the entry is only created
  // once a number is actually in it.
  useAutosave(
    { date, weightKg, waistCm },
    values => upsert.mutate(values),
    { enabled: weightKg != null || waistCm != null },
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-meta text-ink-mute">{t('weight.weightKg')}</span>
          <div className="flex items-baseline gap-1 rounded-control border border-line bg-raised px-3 py-2.5">
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={20}
              max={400}
              placeholder="–"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              className="w-full min-w-0 bg-transparent text-title font-semibold text-ink outline-none"
            />
            <span className="text-meta text-ink-mute">kg</span>
          </div>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-meta text-ink-mute">{t('weight.waistCm')}</span>
          <div className="flex items-baseline gap-1 rounded-control border border-line bg-raised px-3 py-2.5">
            <input
              type="number"
              inputMode="decimal"
              step={0.5}
              min={30}
              max={250}
              placeholder="–"
              value={waist}
              onChange={e => setWaist(e.target.value)}
              className="w-full min-w-0 bg-transparent text-title font-semibold text-ink outline-none"
            />
            <span className="text-meta text-ink-mute">cm</span>
          </div>
        </label>
      </div>

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

  return (
    <Section module="body" title={t('weight.title')} icon={<Scale size={17} />} summary={summary || undefined}>
      <div className="space-y-3">
        {isLoading
          ? <p className="py-4 text-center text-body text-ink-mute">{t('common.loading')}</p>
          : <BodyForm key={date} date={date} entry={entry} />}
      </div>
    </Section>
  )
}
