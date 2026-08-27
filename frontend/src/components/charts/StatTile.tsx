import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * The compact readout used everywhere a number needs a direction: the value,
 * what it did against the week before, and the shape it took getting there.
 *
 * The three parts are one component because a value without its delta invites
 * reading a single day as a trend, which is the mistake the metrics page was
 * making on every tile.
 */
export function StatTile({
  label,
  value,
  hint,
  delta,
  deltaUnit = '',
  lowerIsBetter,
  neutral,
  digits = 1,
}: {
  label: string
  value: string
  hint?: string
  /** Change against the previous comparable period, in the value's own unit. */
  delta?: number | null
  deltaUnit?: string
  /** Losing weight is progress; sleeping less is not. */
  lowerIsBetter?: boolean
  /** For numbers where up and down carry no verdict, e.g. carbs. */
  neutral?: boolean
  /** Decimals on the delta; counts want none, kilograms want two. */
  digits?: number
}) {
  return (
    <div className="min-w-0 rounded-control bg-raised p-3.5">
      {/* The tile is a number and its name. It used to carry a sparkline too,
          which said the same thing as the chart under it in a tenth of the
          space — and cost the number the width it then wrapped for. */}
      <p className="font-display text-title font-semibold leading-tight text-ink tabular">
        {value}
      </p>
      {/* The label wraps rather than truncating: "Aufgestanden" cut to
          "Aufgestan…" is not a label. */}
      <p className="text-meta leading-snug text-ink-mute">{label}</p>
      {/* Two lines rather than one, so a hint that explains a missing value —
          "set a goal in your profile" — is readable instead of cut mid-word. */}
      {hint && <p className="line-clamp-2 text-label text-ink-faint">{hint}</p>}
      {delta !== undefined && (
        <Delta value={delta} unit={deltaUnit} lowerIsBetter={lowerIsBetter} neutral={neutral} digits={digits} />
      )}
    </div>
  )
}

export function Delta({
  value,
  unit = '',
  lowerIsBetter = false,
  neutral = false,
  digits = 1,
}: {
  value: number | null | undefined
  unit?: string
  lowerIsBetter?: boolean
  neutral?: boolean
  digits?: number
}) {
  const { t } = useTranslation()
  if (value == null) return null

  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  if (rounded === 0) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-label text-ink-mute tabular">
        <Minus size={10} /> {t('metrics.vsLastWeek', { delta: '±0', unit })}
      </span>
    )
  }

  const good = lowerIsBetter ? rounded < 0 : rounded > 0
  const tone = neutral ? 'text-ink-mute' : good ? 'text-good' : 'text-bad'
  return (
    <span className={`mt-0.5 flex items-center gap-1 text-label font-medium tabular ${tone}`}>
      {rounded > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {t('metrics.vsLastWeek', { delta: `${rounded > 0 ? '+' : ''}${rounded}`, unit })}
    </span>
  )
}
