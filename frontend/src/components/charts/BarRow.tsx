/**
 * A labelled horizontal bar for ranked comparisons — sets per muscle group,
 * completion per weekday. Ranks read faster down a column than across a row of
 * vertical bars, and the label has room to be a word rather than an initial.
 */
export function BarRow({
  label,
  value,
  max,
  color,
  hint,
  tone,
}: {
  label: string
  value: number
  max: number
  color: string
  /** Right-hand annotation: the number itself, or a change against before. */
  hint?: string
  /** Colours the hint when it carries a verdict. */
  tone?: 'good' | 'bad' | 'mute'
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  const hintClass =
    tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink-mute'

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate text-meta text-ink-soft">{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      {hint && <span className={`w-20 shrink-0 text-right text-label tabular ${hintClass}`}>{hint}</span>}
    </div>
  )
}
