import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { useMeals, useMacroSummary, useDeleteMeal } from '../../features/food/hooks'
import type { MealEntry } from '../../features/food/api'

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

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex-1">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300">{value}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export function FoodLogPage() {
  const [date, setDate] = useState(isoDate(new Date()))

  const { data: meals, isLoading } = useMeals(date)
  const { data: summary } = useMacroSummary(date)
  const deleteMut = useDeleteMeal()

  function shiftDay(delta: number) {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(isoDate(d))
  }

  const byType = (type: string) => meals?.filter(m => m.mealType === type) ?? []

  return (
    <div>
      <PageHeader
        title="Ernährung"
        action={
          <Link to={`/food/search?date=${date}`} className="text-indigo-400 hover:text-indigo-300">
            <Search size={20} />
          </Link>
        }
      />

      <div className="space-y-4 p-4">
        {/* Date nav */}
        <div className="flex items-center justify-between">
          <button onClick={() => shiftDay(-1)} className="text-zinc-400 hover:text-zinc-200">
            <ChevronLeft size={22} />
          </button>
          <p className="text-sm font-medium text-zinc-200">
            {new Date(date + 'T00:00:00').toLocaleDateString('de-DE', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          <button
            onClick={() => shiftDay(1)}
            disabled={date >= isoDate(new Date())}
            className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Macro summary */}
        {summary && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Kalorien</span>
              <span className="text-xl font-bold text-zinc-100">{summary.kcal} kcal</span>
            </div>
            <div className="flex gap-3">
              <MacroBar label="Protein" value={summary.protein} max={200} color="#6366f1" />
              <MacroBar label="Kohlenh." value={summary.carbs} max={300} color="#f97316" />
              <MacroBar label="Fett" value={summary.fat} max={100} color="#eab308" />
            </div>
          </Card>
        )}

        {/* Meal groups */}
        {isLoading && <p className="py-4 text-center text-sm text-zinc-500">Laden…</p>}

        {MEAL_TYPES.map(type => {
          const entries = byType(type)
          if (entries.length === 0) return null
          return (
            <div key={type}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {MEAL_LABELS[type]}
              </p>
              <div className="space-y-1.5">
                {entries.map((m: MealEntry) => (
                  <Card key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-100">
                        {m.foodItem.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {m.grams}g · {m.kcal} kcal · {m.protein}g Protein
                      </p>
                    </div>
                    <button
                      onClick={() => deleteMut.mutate({ id: m.id, date })}
                      className="text-zinc-600 hover:text-red-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}

        {!isLoading && (!meals || meals.length === 0) && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-zinc-500 text-sm">Noch keine Mahlzeiten geloggt.</p>
            <Link
              to={`/food/search?date=${date}`}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Lebensmittel suchen
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
