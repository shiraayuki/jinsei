import { useState } from 'react'
import { Apple, Coffee, Droplet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../../i18n'
import { useNutritionDay, useUpsertNutrition } from '../../../features/nutrition/hooks'
import type { NutritionEntry } from '../../../features/nutrition/api'
import { Section, SaveButton } from './Section'
import { ScreenshotImport } from '../../../components/ui/ScreenshotImport'
import type { NutritionDraftFields } from '../../../features/import/api'
import { GoalBar } from '../../../components/ui/GoalBar'
import { useAuth } from '../../../app/auth/AuthProvider'

function numOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Adds to whatever is already in the field, the way the quick chips are meant to work. */
function addTo(current: string, amount: number, decimals = 0): string {
  const next = (numOrNull(current) ?? 0) + amount
  return decimals > 0 ? String(Number(next.toFixed(decimals))) : String(Math.round(next))
}

function MacroField({ label, color, value, onChange }: {
  label: string
  color: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 rounded-xl bg-gray-100 dark:bg-zinc-800 p-3">
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
      <div className="flex min-w-0 items-baseline gap-1">
        <input
          type="number"
          inputMode="numeric"
          placeholder="–"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent text-base font-semibold text-gray-900 dark:text-white outline-none"
        />
        <span className="text-xs text-gray-400 dark:text-zinc-500">g</span>
      </div>
    </label>
  )
}

function Chips({ amounts, unit, onAdd, onReset }: {
  amounts: { label: string; value: number }[]
  unit: string
  onAdd: (v: number) => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2">
      {amounts.map(a => (
        <button
          key={a.value}
          type="button"
          onClick={() => onAdd(a.value)}
          className="rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
        >
          +{a.label} {unit}
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="ml-auto rounded-lg px-3 py-2 text-xs font-medium text-gray-400 dark:text-zinc-500 hover:text-red-400 transition-colors"
      >
        {t('nutrition.reset')}
      </button>
    </div>
  )
}

/**
 * Remounted by the parent whenever the loaded day changes, so the fields can be
 * seeded from the entry once instead of being synced in an effect.
 */
function NutritionForm({ date, entry, onSelectDate }: {
  date: string
  entry?: NutritionEntry
  onSelectDate?: (date: string) => void
}) {
  const { t } = useTranslation()
  const upsert = useUpsertNutrition()
  const { user } = useAuth()

  const str = (v: number | null | undefined) => (v == null ? '' : String(v))

  const [kcal, setKcal] = useState(str(entry?.kcal))
  const [protein, setProtein] = useState(str(entry?.proteinG))
  const [carbs, setCarbs] = useState(str(entry?.carbsG))
  const [fat, setFat] = useState(str(entry?.fatG))
  const [water, setWater] = useState(str(entry?.waterL))
  const [coffee, setCoffee] = useState(str(entry?.coffeeMl))
  const [lastCoffee, setLastCoffee] = useState(entry?.lastCoffee ?? '')

  const p = numOrNull(protein) ?? 0
  const c = numOrNull(carbs) ?? 0
  const f = numOrNull(fat) ?? 0
  // Macro split by calories, not by grams — fat carries more than twice the
  // energy per gram, so a gram-based bar would misrepresent the day.
  const macroKcal = p * 4 + c * 4 + f * 9
  const share = (grams: number, perGram: number) =>
    macroKcal > 0 ? Math.round((grams * perGram * 100) / macroKcal) : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    upsert.mutate({
      date,
      kcal: numOrNull(kcal),
      proteinG: numOrNull(protein),
      carbsG: numOrNull(carbs),
      fatG: numOrNull(fat),
      waterL: numOrNull(water),
      coffeeMl: numOrNull(coffee),
      lastCoffee: lastCoffee || null,
      notes: null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ScreenshotImport<NutritionDraftFields>
        kind="nutrition"
        date={date}
        onSelectDate={onSelectDate}
        // Water and coffee are not in a FatSecret screenshot, so they are left
        // to the chips below; a macro the screenshot did not show stays as it is.
        onApply={f => {
          if (f.kcal != null) setKcal(String(f.kcal))
          if (f.proteinG != null) setProtein(String(f.proteinG))
          if (f.carbsG != null) setCarbs(String(f.carbsG))
          if (f.fatG != null) setFat(String(f.fatG))
        }}
      />

      <div>
        <label className="mb-1 block text-xs text-gray-400 dark:text-zinc-500">{t('nutrition.calories')}</label>
        <div className="flex items-baseline gap-2 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2.5">
          <input
            type="number"
            inputMode="numeric"
            step={10}
            placeholder="–"
            value={kcal}
            onChange={e => setKcal(e.target.value)}
            className="w-full min-w-0 bg-transparent text-lg font-bold text-gray-900 dark:text-white outline-none"
          />
          <span className="text-xs text-gray-400 dark:text-zinc-500">kcal</span>
        </div>
        <div className="mt-1.5">
          <GoalBar value={numOrNull(kcal)} goal={user?.kcalGoal ?? null} unit=" kcal" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <MacroField label={t('nutrition.protein')} color="#818cf8" value={protein} onChange={setProtein} />
          <MacroField label={t('nutrition.carbs')} color="#34d399" value={carbs} onChange={setCarbs} />
          <MacroField label={t('nutrition.fat')} color="#fbbf24" value={fat} onChange={setFat} />
        </div>

        {macroKcal > 0 && (
          <>
            <div className="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
              <div style={{ width: `${share(p, 4)}%`, background: '#818cf8' }} />
              <div style={{ width: `${share(c, 4)}%`, background: '#34d399' }} />
              <div style={{ width: `${share(f, 9)}%`, background: '#fbbf24' }} />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500">
              {share(p, 4)}% · {share(c, 4)}% · {share(f, 9)}% {t('nutrition.ofCalories')}
            </p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
            <Droplet size={13} /> {t('nutrition.water')}
          </span>
          <div className="flex items-baseline gap-1 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2">
            <input
              type="number"
              inputMode="decimal"
              step={0.25}
              placeholder="0"
              value={water}
              onChange={e => setWater(e.target.value)}
              className="w-20 min-w-0 bg-transparent text-right text-sm font-semibold text-gray-900 dark:text-white outline-none"
            />
            <span className="text-xs text-gray-400 dark:text-zinc-500">L</span>
          </div>
        </div>
        <GoalBar value={numOrNull(water)} goal={user?.waterGoalL ?? null} unit=" L" />
        <Chips
          amounts={[{ label: '0,25', value: 0.25 }, { label: '0,5', value: 0.5 }, { label: '1', value: 1 }]}
          unit="L"
          onAdd={v => setWater(addTo(water, v, 2))}
          onReset={() => setWater('')}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
            <Coffee size={13} /> {t('nutrition.coffee')}
          </span>
          <div className="flex items-baseline gap-1 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2">
            <input
              type="number"
              inputMode="numeric"
              step={50}
              placeholder="0"
              value={coffee}
              onChange={e => setCoffee(e.target.value)}
              className="w-20 min-w-0 bg-transparent text-right text-sm font-semibold text-gray-900 dark:text-white outline-none"
            />
            <span className="text-xs text-gray-400 dark:text-zinc-500">ml</span>
          </div>
        </div>
        <Chips
          amounts={[{ label: '100', value: 100 }, { label: '200', value: 200 }, { label: '250', value: 250 }]}
          unit="ml"
          onAdd={v => setCoffee(addTo(coffee, v))}
          onReset={() => setCoffee('')}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-400 dark:text-zinc-500">{t('nutrition.lastCoffee')}</label>
        <input
          type="time"
          value={lastCoffee}
          onChange={e => setLastCoffee(e.target.value)}
          className="w-full rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <SaveButton pending={upsert.isPending} label={t('common.save')} />
    </form>
  )
}

export function NutritionSection({ date, onSelectDate }: {
  date: string
  onSelectDate?: (date: string) => void
}) {
  const { t } = useTranslation()
  const { data: entry, isLoading } = useNutritionDay(date)

  const summary = entry?.kcal != null ? `${entry.kcal.toLocaleString(dateLocale())} kcal` : undefined

  return (
    <Section title={t('nutrition.title')} icon={<Apple size={15} />} summary={summary}>
      {isLoading
        ? <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">{t('common.loading')}</p>
        : <NutritionForm key={`${date}:${entry?.id ?? 'new'}`} date={date} entry={entry} onSelectDate={onSelectDate} />}
    </Section>
  )
}
