import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'

/**
 * Shows a value against its target. Renders nothing without a goal, so callers
 * can drop it in unconditionally.
 */
export function GoalBar({ value, goal, unit = '', color }: {
  value: number | null
  goal: number | null
  unit?: string
  /** The module's colour; the bar is data, so it should not read as brand. */
  color?: string
}) {
  const { t } = useTranslation()
  if (goal == null || goal <= 0) return null

  const current = value ?? 0
  const pct = Math.min(100, Math.round((current / goal) * 100))
  const over = current > goal

  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? 'var(--warn)' : color ?? 'var(--accent)' }}
        />
      </div>
      <p className="text-label text-ink-mute tabular">
        {current.toLocaleString(dateLocale())}{unit} {t('goals.of', { goal: goal.toLocaleString(dateLocale()) + unit })} · {pct}%
      </p>
    </div>
  )
}
