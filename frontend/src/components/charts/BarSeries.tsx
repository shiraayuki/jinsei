/** Compact bars for one value per day, used where a line would over-imply continuity. */
export function BarSeries({
  points,
  color,
  max,
  height = 48,
}: {
  points: { date: string; value: number | null }[]
  /** The module's colour as a CSS variable — see MetricChart on why. */
  color: string
  /** Fixed ceiling, e.g. 100 for a percentage. Defaults to the largest value. */
  max?: number
  height?: number
}) {
  const values = points.map(p => p.value).filter((v): v is number => v != null)
  if (values.length === 0) return null
  const ceiling = max ?? Math.max(...values)

  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {points.map(p => (
        <div
          key={p.date}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: p.value == null ? 2 : Math.max(2, (p.value / (ceiling || 1)) * (height - 4) + 2),
            // A missing day is drawn as a stub in the hairline colour rather
            // than in the series colour, so gaps read as gaps.
            background: p.value == null ? 'var(--line-strong)' : color,
          }}
          title={`${p.date}: ${p.value ?? '–'}`}
        />
      ))}
    </div>
  )
}
