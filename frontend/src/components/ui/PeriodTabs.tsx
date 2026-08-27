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
      <div className="segmented flex items-center">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-pressed={value === p}
            aria-label={t(`metrics.periods.${p}`)}
            className="segmented-item px-2.5 py-1 text-meta tabular"
          >
            {t(`metrics.periodsShort.${p}`)}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="segmented flex items-center">
      {PERIODS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className="segmented-item min-w-0 flex-1 truncate px-2 py-1.5 text-meta"
        >
          {t(`metrics.periods.${p}`)}
        </button>
      ))}
    </div>
  )
}
