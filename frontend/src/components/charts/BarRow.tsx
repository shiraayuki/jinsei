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
  segments,
}: {
  label: string
  value: number
  max: number
  color: string
  /** Right-hand annotation: the number itself, or a change against before. */
  hint?: string
  /** Colours the hint when it carries a verdict. */
  tone?: 'good' | 'bad' | 'mute'
  /**
   * Draws the bar as its parts instead of as one block — the phases of a
   * night, in the order given. Parts that do not add up to `value` leave the
   * rest of the bar in `color`, so a night logged without its phases still
   * shows its length.
   */
  segments?: { key: string; value: number; color: string }[]
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  const hintClass =
    tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink-mute'

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate text-body text-ink-soft">{label}</span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
        <div className="flex h-full rounded-full" style={{ width: `${pct}%`, background: color }}>
          {segments?.map(seg => (
            <div
              key={seg.key}
              style={{ width: value > 0 ? `${(seg.value / value) * 100}%` : 0, background: seg.color }}
            />
          ))}
        </div>
      </div>
      {hint && <span className={`w-24 shrink-0 text-right text-meta tabular ${hintClass}`}>{hint}</span>}
    </div>
  )
}
