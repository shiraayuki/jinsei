import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'

/**
 * Protein, carbs and fat as shares of the energy they carried, not of their
 * weight in grams — a gram of fat is more than twice a gram of protein, so a
 * split by mass tells you nothing about how the day was built.
 */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 }

export function MacroSplit({ proteinG, carbsG, fatG }: { proteinG: number; carbsG: number; fatG: number }) {
  const { t } = useTranslation()

  const parts = [
    { key: 'protein', label: t('nutrition.protein'), grams: proteinG, kcal: proteinG * KCAL_PER_GRAM.protein, color: 'var(--c-food)' },
    { key: 'carbs', label: t('metrics.food.carbs'), grams: carbsG, kcal: carbsG * KCAL_PER_GRAM.carbs, color: 'var(--c-move)' },
    { key: 'fat', label: t('metrics.food.fat'), grams: fatG, kcal: fatG * KCAL_PER_GRAM.fat, color: 'var(--c-mind)' },
  ]

  const total = parts.reduce((s, p) => s + p.kcal, 0)
  if (total <= 0) return null

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-raised">
        {parts.map(p => (
          <div key={p.key} style={{ width: `${(p.kcal / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map(p => (
          <span key={p.key} className="flex items-center gap-1.5 text-label text-ink-mute tabular">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} {Math.round((p.kcal / total) * 100)}%
            <span className="text-ink-faint">
              {p.grams.toLocaleString(dateLocale(), { maximumFractionDigits: 0 })} g
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
