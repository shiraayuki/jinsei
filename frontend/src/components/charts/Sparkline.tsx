import { movingAverage, type Point } from '../../lib/stats'

/**
 * A shape, not a chart: no axes, no labels, no interaction. It sits inside a
 * stat tile to say which way the number has been going, and the number itself
 * says how far.
 */
export function Sparkline({
  points,
  color,
  width = 64,
  height = 20,
  smooth,
}: {
  points: Point[]
  color: string
  width?: number
  height?: number
  /** Smooth over this many readings, for series that swing daily. */
  smooth?: number
}) {
  const source = smooth ? movingAverage(points, smooth, 1) : points
  const values = source.map(p => p.value).filter((v): v is number => v != null)
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const coords = source
    .map((p, i) =>
      p.value == null
        ? null
        : {
            x: (i / Math.max(source.length - 1, 1)) * width,
            y: 1 + ((max - p.value) / range) * (height - 2),
          },
    )
    .filter((c): c is { x: number; y: number } => c != null)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible" aria-hidden>
      <polyline
        points={coords.map(c => `${c.x},${c.y}`).join(' ')}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: color, strokeOpacity: 0.85 }}
      />
    </svg>
  )
}
