import { useTranslation } from 'react-i18next'
import { PERIODS, type Period } from '../../lib/period'

/**
 * The switch for the counted numbers: this week, this month, the last six
 * months, the last year.
 *
 * It takes the header slot on the overview, where the range switch would
 * answer the wrong question: that one sets how far a chart reaches back, this
 * one sets which period is being totalled.
 */
export function PeriodTabs({
  value,
  onChange,
  compact,
}: {
  value: Period
  onChange: (period: Period) => void
  /** Header size, next to the section title, with the labels down to a letter. */
  compact?: boolean
}) {
  const { t } = useTranslation()

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 rounded-chip bg-raised p-0.5">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-pressed={value === p}
            aria-label={t(`metrics.periods.${p}`)}
            className={`rounded-chip px-2 py-1 text-label font-medium tabular transition-colors ${
              value === p ? 'bg-surface text-ink shadow-[var(--card-shadow)]' : 'text-ink-mute hover:text-ink-soft'
            }`}
          >
            {t(`metrics.periodsShort.${p}`)}
          </button>
        ))}
      </div>
    )
  }

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
