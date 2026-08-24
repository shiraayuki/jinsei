import { dateLocale } from '../../i18n'

export interface Series {
  label: string
  /**
   * The module's colour as a CSS variable, so the series follows the theme.
   * SVG attributes cannot parse `var()`, which is why everything below paints
   * through `style` rather than `stroke=` and `fill=`.
   */
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
        {paths.map(p => {
          // The line that carries the meaning: the average when there is one,
          // the raw readings when there is not.
          const lead = p.averageCoords.length > 0 ? p.averageCoords : p.coords
          const end = lead[lead.length - 1]
          return (
            <g key={p.label}>
              {lead.length > 1 && (
                <polygon
                  points={`${lead[0].x},${H} ${lead.map(c => `${c.x},${c.y}`).join(' ')} ${lead[lead.length - 1].x},${H}`}
                  style={{ fill: p.color, fillOpacity: 0.12 }}
                />
              )}
              <polyline
                points={p.coords.map(c => `${c.x},${c.y}`).join(' ')}
                fill="none"
                strokeWidth={p.averageCoords.length > 0 ? 1.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: p.color, strokeOpacity: p.averageCoords.length > 0 ? 0.35 : 1 }}
              />
              {p.averageCoords.length > 0 && (
                <polyline
                  points={p.averageCoords.map(c => `${c.x},${c.y}`).join(' ')}
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: p.color }}
                />
              )}
              {/* The last reading is the one being asked about, so it is the
                  only point drawn. */}
              {end && <circle cx={end.x} cy={end.y} r="3" style={{ fill: p.color }} />}
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-ink-faint tabular">
        {paths.map(p => (
          <span key={p.label} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: p.color }} />
            {p.label} {p.min === p.max ? p.min : `${p.min}–${p.max}`}{p.unit ?? ''}
          </span>
        ))}
        <span className="ml-auto">{formatDate(dates[0])} – {formatDate(dates[dates.length - 1])}</span>
      </div>
    </div>
  )
}
