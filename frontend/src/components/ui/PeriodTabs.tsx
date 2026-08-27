import { useTranslation } from 'react-i18next'
import { PERIODS, type Period } from '../../lib/period'

/**
 * The switch for the counted numbers: this week, this month, the last six
 * months, the last year.
 *
 * It sits inside its block rather than in the header, because it answers a
 * different question than the range switch above it — that one sets how far a
 * chart reaches back, this one sets which period is being totalled.
 */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: Period
  onChange: (period: Period) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-0.5 rounded-chip bg-raised p-0.5">
      {PERIODS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={`min-w-0 flex-1 truncate rounded-chip px-2 py-1.5 text-label font-medium transition-colors ${
            value === p ? 'bg-surface text-ink shadow-[var(--card-shadow)]' : 'text-ink-mute hover:text-ink-soft'
          }`}
        >
          {t(`metrics.periods.${p}`)}
        </button>
      ))}
    </div>
  )
}
