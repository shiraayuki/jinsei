import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'

/**
 * Shows a value against its target. Renders nothing without a goal, so callers
 * can drop it in unconditionally.
 */
export function GoalBar({ value, goal, unit = '' }: { value: number | null; goal: number | null; unit?: string }) {
  const { t } = useTranslation()
  if (goal == null || goal <= 0) return null

  const current = value ?? 0
  const pct = Math.min(100, Math.round((current / goal) * 100))
  const over = current > goal

  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 dark:text-zinc-500">
        {current.toLocaleString(dateLocale())}{unit} {t('goals.of', { goal: goal.toLocaleString(dateLocale()) + unit })} · {pct}%
      </p>
    </div>
  )
}
