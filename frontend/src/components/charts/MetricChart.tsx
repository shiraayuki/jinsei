import { dateLocale } from '../../i18n'

export interface Series {
  label: string
  color: string
  /** Points in chronological order; gaps are allowed and are skipped. */
  points: { date: string; value: number | null }[]
  unit?: string
  /**
   * Draw a trailing average over this many readings alongside the raw line.
   * Daily weigh-ins swing by more than the trend they are meant to show.
   */
  averageOver?: number
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
}

/**
 * Line chart for one or two series over the same span. Each series is scaled to
 * its own range: weight and waist share a page but not a unit, and forcing them
 * onto one axis would flatten both.
 */
export function MetricChart({ series, height = 90 }: { series: Series[]; height?: number }) {
  const withData = series.filter(s => s.points.some(p => p.value != null))
  if (withData.length === 0) return null

  const W = 300
  const H = height
  const PAD = 10
  const dates = withData[0].points.map(p => p.date)

  const paths = withData.map(s => {
    const values = s.points.map(p => p.value).filter((v): v is number => v != null)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    // The average walks over the readings that exist, ignoring the gaps, so a
    // missed day does not drag the line.
    const seen: number[] = []
    const averaged = s.points.map(p => {
      if (p.value == null) return null
      seen.push(p.value)
      const window = seen.slice(-(s.averageOver ?? 1))
      return window.reduce((sum, v) => sum + v, 0) / window.length
    })

    const coords = s.points
      .map((p, i) => {
        if (p.value == null) return null
        const x = PAD + (s.points.length > 1 ? (i / (s.points.length - 1)) * (W - PAD * 2) : (W - PAD * 2) / 2)
        const y = PAD + ((max - p.value) / range) * (H - PAD * 2)
        return { x, y }
      })
      .filter((c): c is { x: number; y: number } => c != null)

    const averageCoords = s.averageOver
      ? s.points
          .map((_point, i) => {
            const value = averaged[i]
            if (value == null) return null
            const x = PAD + (s.points.length > 1 ? (i / (s.points.length - 1)) * (W - PAD * 2) : (W - PAD * 2) / 2)
            const y = PAD + ((max - value) / range) * (H - PAD * 2)
            return { x, y }
          })
          .filter((c): c is { x: number; y: number } => c != null)
      : []

    return { ...s, coords, averageCoords, min, max, last: values[values.length - 1] }
  })

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {paths.map(p => (
          <g key={p.label}>
            <polyline
              points={p.coords.map(c => `${c.x},${c.y}`).join(' ')}
              fill="none"
              stroke={p.color}
              strokeWidth={p.averageCoords.length > 0 ? 1.5 : 2}
              strokeOpacity={p.averageCoords.length > 0 ? 0.3 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {p.averageCoords.length > 0 && (
              <polyline
                points={p.averageCoords.map(c => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke={p.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {p.coords.map((c, i) => (
              <circle key={i} cx={c.x} cy={c.y} r="2" fill={p.color} fillOpacity="0.5" />
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400 dark:text-zinc-600">
        {paths.map(p => (
          <span key={p.label} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: p.color }} />
            {p.label} {p.min === p.max ? p.min : `${p.min}–${p.max}`}{p.unit ?? ''}
          </span>
        ))}
        <span className="ml-auto">{formatDate(dates[0])} – {formatDate(dates[dates.length - 1])}</span>
      </div>
    </div>
  )
}
