import { useTranslation } from 'react-i18next'
import { RANGES, type Range } from '../../lib/useRange'

/**
 * The one time-range switch, used by every screen that shows a series.
 *
 * The compact variant is the same control at header size: it sits next to the
 * section title instead of on a row of its own, which is what keeps the metrics
 * page down to a single line of chrome before the first chart.
 */
export function RangeTabs({
  value,
  onChange,
  compact,
}: {
  value: Range
  onChange: (days: Range) => void
  compact?: boolean
}) {
  const { t } = useTranslation()

  if (compact) {
    return (
      <div className="segmented flex items-center">
        {RANGES.map(r => (
          <button
            key={r}
            onClick={() => onChange(r)}
            aria-pressed={value === r}
            className="segmented-item px-2.5 py-1 text-meta tabular"
          >
            {r === 365 ? t('metrics.rangeYearShort') : t('metrics.rangeDays', { count: r })}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="segmented flex">
      {RANGES.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className="segmented-item flex-1 py-1.5 text-meta"
        >
          {r === 365 ? t('metrics.rangeYear') : t('metrics.rangeDays', { count: r })}
        </button>
      ))}
    </div>
  )
}
