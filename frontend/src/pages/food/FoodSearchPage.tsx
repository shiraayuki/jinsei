import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSearchFood, useSaveFoodItem, useLogMeal } from '../../features/food/hooks'
import type { FoodItem } from '../../features/food/api'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack',
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

interface LogState {
  item: FoodItem
  grams: string
  mealType: string
}

export function FoodSearchPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const date = params.get('date') ?? isoDate(new Date())

  const [query, setQuery] = useState('')
  const [logState, setLogState] = useState<LogState | null>(null)

  const { data: results, isFetching } = useSearchFood(query)
  const saveItem = useSaveFoodItem()
  const logMeal = useLogMeal()

  function selectItem(item: FoodItem) {
    setLogState({ item, grams: String(item.servingSizeG ?? 100), mealType: 'lunch' })
  }

  async function confirmLog() {
    if (!logState) return
    const { item, grams, mealType } = logState

    // Save item to DB if not yet saved
    let savedId = item.id
    if (!savedId) {
      const saved = await saveItem.mutateAsync({
        source: item.source,
        externalId: item.externalId,
        name: item.name,
        brand: item.brand,
        kcalPer100g: item.kcalPer100g,
        proteinPer100g: item.proteinPer100g,
        carbsPer100g: item.carbsPer100g,
        fatPer100g: item.fatPer100g,
        fiberPer100g: item.fiberPer100g,
        servingSizeG: item.servingSizeG,
      })
      savedId = saved.id
    }

    await logMeal.mutateAsync({
      date,
      mealType,
      foodItemId: savedId!,
      grams: Number(grams),
    })

    navigate(`/food`)
  }

  const kcalPreview = logState
    ? Math.round((logState.item.kcalPer100g * Number(logState.grams || 0)) / 100)
    : 0

  return (
    <div>
      <PageHeader title="Lebensmittel suchen" back />

      <div className="space-y-4 p-4">
        {/* Search input */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="z.B. Banane, Haferflocken…"
            autoFocus
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-800/60 pl-9 pr-3 text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500"
          />
        </div>

        {/* Log panel */}
        {logState && (
          <Card className="space-y-3 p-4">
            <div>
              <p className="font-medium text-zinc-100">{logState.item.name}</p>
              {logState.item.brand && <p className="text-xs text-zinc-500">{logState.item.brand}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Menge (g)"
                type="number"
                min="1"
                value={logState.grams}
                onChange={e => setLogState(s => s && { ...s, grams: e.target.value })}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm text-zinc-400">Mahlzeit</label>
                <select
                  value={logState.mealType}
                  onChange={e => setLogState(s => s && { ...s, mealType: e.target.value })}
                  className="h-11 rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-zinc-100 outline-none focus:border-indigo-500"
                >
                  {MEAL_TYPES.map(t => (
                    <option key={t} value={t}>{MEAL_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-sm text-zinc-400">
              ≈ <span className="font-semibold text-zinc-100">{kcalPreview} kcal</span>
              {' · '}
              {Math.round((logState.item.proteinPer100g * Number(logState.grams || 0)) / 100 * 10) / 10}g Protein
            </p>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setLogState(null)}>
                Abbrechen
              </Button>
              <Button
                className="flex-1"
                onClick={confirmLog}
                loading={saveItem.isPending || logMeal.isPending}
              >
                Loggen
              </Button>
            </div>
          </Card>
        )}

        {/* Results */}
        {isFetching && <p className="py-4 text-center text-sm text-zinc-500">Suche…</p>}

        {!logState && results && results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((item, i) => (
              <button
                key={item.id ?? item.externalId ?? i}
                onClick={() => selectItem(item)}
                className="w-full text-left"
              >
                <Card className="flex items-center gap-3 px-3 py-2.5 hover:border-zinc-700 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">{item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {item.brand && `${item.brand} · `}
                      {item.kcalPer100g} kcal / 100g
                      {' · '}P {item.proteinPer100g}g
                    </p>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}

        {!isFetching && query.length >= 2 && results?.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">Keine Ergebnisse für „{query}".</p>
        )}

        {query.length < 2 && !logState && (
          <p className="py-8 text-center text-sm text-zinc-600">Mind. 2 Zeichen eingeben.</p>
        )}
      </div>
    </div>
  )
}
