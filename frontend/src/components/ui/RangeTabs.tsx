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
      <div className="flex items-center gap-0.5 rounded-chip bg-raised p-0.5">
        {RANGES.map(r => (
          <button
            key={r}
            onClick={() => onChange(r)}
            aria-pressed={value === r}
            className={`rounded-chip px-2 py-1 text-label font-medium tabular transition-colors ${
              value === r ? 'bg-surface text-ink shadow-[var(--card-shadow)]' : 'text-ink-mute hover:text-ink-soft'
            }`}
          >
            {r === 365 ? t('metrics.rangeYearShort') : t('metrics.rangeDays', { count: r })}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      {RANGES.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={`flex-1 rounded-chip py-2 text-meta font-medium transition-colors ${
            value === r ? 'bg-accent text-white' : 'bg-raised text-ink-soft hover:bg-line'
          }`}
        >
          {r === 365 ? t('metrics.rangeYear') : t('metrics.rangeDays', { count: r })}
        </button>
      ))}
    </div>
  )
}
