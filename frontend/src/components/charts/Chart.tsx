import { useState } from 'react'
import { dateLocale } from '../../i18n'
import { movingAverage, type Point } from '../../lib/stats'

/**
 * The one chart in the app.
 *
 * Lines, bars, the goal line and the trend overlay are the same component
 * because they have to share a grid, a padding and a way of drawing a missing
 * day — three chart implementations produced three answers to each of those.
 *
 * Colours arrive as CSS variables so the series follows the theme. SVG
 * attributes cannot parse `var()`, which is why everything paints through
 * `style` rather than through `stroke=` and `fill=`.
 */

export interface ChartSeries {
  label: string
  color: string
  points: Point[]
  /** Bars for values that belong to one day, lines for a quantity that carries over. */
  kind?: 'line' | 'bar'
  unit?: string
  /**
   * Draw a trailing average over this many readings on top of the raw series,
   * which is then held back. Daily readings swing by more than the trend they
   * are meant to show.
   */
  averageOver?: number
  /**
   * Scale against this series instead of its own range. Two series only share
   * a shape when they share a domain; weight and waist do not.
   */
  scaleWith?: string
}

export interface ChartGoal {
  value: number
  label?: string
  /** Draws a band of ±tolerance·goal around the line, as the range that counts as hit. */
  tolerance?: number
}

interface Props {
  series: ChartSeries[]
  height?: number
  goal?: ChartGoal
  /** Bars always start at zero; lines only when the zero carries meaning. */
  zeroBased?: boolean
  /** Renders the number in the grid labels and the readout. */
  format?: (value: number) => string
  /** Shown instead of the chart when nothing has been logged yet. */
  empty?: string
}

const W = 320
const PAD_X = 6
const PAD_TOP = 12
const PAD_BOTTOM = 4
/** Room on the right for the grid labels, which sit inside the plot. */
const GUTTER = 34

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
}

function niceStep(range: number): number {
  const raw = range / 2
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1))
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (raw <= factor * magnitude) return factor * magnitude
  }
  return 10 * magnitude
}

export function Chart({ series, height = 108, goal, zeroBased, format, empty }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const withData = series.filter(s => s.points.some(p => p.value != null))
  const dates = withData[0]?.points.map(p => p.date) ?? []

  // Not memoised: the input arrays are rebuilt on every render anyway, so a
  // dependency list would only ever miss, and the work is a pass over a few
  // hundred numbers.
  const scales = (() => {
    const map = new Map<string, { min: number; max: number }>()
    for (const s of withData) {
      const key = s.scaleWith ?? s.label
      const values = s.points.map(p => p.value).filter((v): v is number => v != null)
      if (values.length === 0) continue
      // The goal has to sit inside the plot, or a chart drawn well under its
      // target shows no line at all and reads as "on track".
      if (goal && (s.scaleWith ?? s.label) === (withData[0].scaleWith ?? withData[0].label)) values.push(goal.value)
      const existing = map.get(key)
      let min = Math.min(...values, existing?.min ?? Infinity)
      let max = Math.max(...values, existing?.max ?? -Infinity)
      if (zeroBased || s.kind === 'bar') min = Math.min(0, min)
      if (min === max) { min -= 1; max += 1 }
      else {
        // A whisker of headroom, so the highest point is not welded to the top edge.
        const padding = (max - min) * 0.08
        max += padding
        if (!zeroBased && s.kind !== 'bar') min -= padding
      }
      map.set(key, { min, max })
    }
    return map
  })()

  if (withData.length === 0) {
    return (
      <p className="py-6 text-center text-meta text-ink-faint">{empty ?? '—'}</p>
    )
  }

  const plotW = W - PAD_X * 2 - GUTTER
  const plotH = height - PAD_TOP - PAD_BOTTOM
  const count = dates.length

  const x = (i: number) => PAD_X + (count > 1 ? (i / (count - 1)) * plotW : plotW / 2)
  const yFor = (key: string) => (value: number) => {
    const scale = scales.get(key)!
    return PAD_TOP + ((scale.max - value) / (scale.max - scale.min)) * plotH
  }

  const primaryKey = withData[0].scaleWith ?? withData[0].label
  const primaryScale = scales.get(primaryKey)!
  const yPrimary = yFor(primaryKey)

  // Grid lines land on round numbers rather than on thirds of the range, so
  // the labels are readable without doing arithmetic.
  const step = niceStep(primaryScale.max - primaryScale.min)
  const gridValues: number[] = []
  for (let v = Math.ceil(primaryScale.min / step) * step; v <= primaryScale.max; v += step) {
    gridValues.push(Math.round(v * 1000) / 1000)
  }

  const fmt = format ?? ((v: number) => v.toLocaleString(dateLocale(), { maximumFractionDigits: 1 }))
  const barWidth = Math.max(1.5, Math.min(12, (plotW / Math.max(count, 1)) * 0.72))

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-none overflow-visible"
        onPointerDown={e => setHover(indexFromEvent(e, count))}
        onPointerMove={e => e.buttons > 0 && setHover(indexFromEvent(e, count))}
        onPointerLeave={() => setHover(null)}
      >
        {gridValues.map(v => (
          <g key={v}>
            <line
              x1={PAD_X} x2={PAD_X + plotW} y1={yPrimary(v)} y2={yPrimary(v)}
              style={{ stroke: 'var(--line)' }} strokeWidth="1"
            />
            <text
              x={PAD_X + plotW + 4} y={yPrimary(v) + 3}
              className="fill-[var(--ink-faint)]" style={{ fontSize: 9 }}
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {goal && (
          <g>
            {goal.tolerance != null && (
              <rect
                x={PAD_X}
                y={yPrimary(goal.value * (1 + goal.tolerance))}
                width={plotW}
                height={Math.abs(yPrimary(goal.value * (1 - goal.tolerance)) - yPrimary(goal.value * (1 + goal.tolerance)))}
                style={{ fill: 'var(--ink-faint)', fillOpacity: 0.08 }}
              />
            )}
            <line
              x1={PAD_X} x2={PAD_X + plotW} y1={yPrimary(goal.value)} y2={yPrimary(goal.value)}
              strokeDasharray="3 3" strokeWidth="1.25"
              style={{ stroke: 'var(--ink-mute)' }}
            />
          </g>
        )}

        {withData.map(s => {
          const y = yFor(s.scaleWith ?? s.label)
          const baseline = y(Math.max(0, scales.get(s.scaleWith ?? s.label)!.min))

          if (s.kind === 'bar') {
            return (
              <g key={s.label}>
                {s.points.map((p, i) => (
                  <rect
                    key={p.date}
                    x={x(i) - barWidth / 2}
                    y={p.value == null ? baseline - 1.5 : Math.min(y(p.value), baseline)}
                    width={barWidth}
                    height={p.value == null ? 1.5 : Math.max(1.5, Math.abs(baseline - y(p.value)))}
                    rx={Math.min(2, barWidth / 2)}
                    // A missing day is a hairline stub in the line colour, so a
                    // gap reads as a gap rather than as a zero.
                    style={{ fill: p.value == null ? 'var(--line-strong)' : s.color, fillOpacity: p.value == null ? 1 : 0.85 }}
                  />
                ))}
              </g>
            )
          }

          const raw = s.points.map((p, i) => (p.value == null ? null : { x: x(i), y: y(p.value) }))
          const avg = s.averageOver
            ? movingAverage(s.points, s.averageOver).map((p, i) => (p.value == null ? null : { x: x(i), y: y(p.value) }))
            : []
          const lead = avg.length > 0 ? avg : raw
          const leadPoints = lead.filter((c): c is { x: number; y: number } => c != null)
          const end = leadPoints[leadPoints.length - 1]

          return (
            <g key={s.label}>
              {leadPoints.length > 1 && (
                <polygon
                  points={`${leadPoints[0].x},${baseline} ${leadPoints.map(c => `${c.x},${c.y}`).join(' ')} ${end.x},${baseline}`}
                  style={{ fill: s.color, fillOpacity: 0.1 }}
                />
              )}
              {segments(raw).map((seg, i) => (
                <polyline
                  key={i}
                  points={seg.map(c => `${c.x},${c.y}`).join(' ')}
                  fill="none"
                  strokeWidth={avg.length > 0 ? 1.25 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: s.color, strokeOpacity: avg.length > 0 ? 0.3 : 1 }}
                />
              ))}
              {segments(avg).map((seg, i) => (
                <polyline
                  key={`avg-${i}`}
                  points={seg.map(c => `${c.x},${c.y}`).join(' ')}
                  fill="none" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"
                  style={{ stroke: s.color }}
                />
              ))}
              {end && <circle cx={end.x} cy={end.y} r="3" style={{ fill: s.color }} />}
            </g>
          )
        })}

        {hover != null && dates[hover] && (
          <line
            x1={x(hover)} x2={x(hover)} y1={PAD_TOP} y2={PAD_TOP + plotH}
            strokeWidth="1" style={{ stroke: 'var(--ink-faint)' }}
          />
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-label text-ink-faint tabular">
        {hover != null && dates[hover] ? (
          <>
            <span className="text-ink-soft">{formatDate(dates[hover])}</span>
            {withData.map(s => (
              <span key={s.label} className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                {s.points[hover]?.value != null ? `${fmt(s.points[hover].value!)}${s.unit ?? ''}` : '–'}
              </span>
            ))}
          </>
        ) : (
          <>
            {withData.map(s => (
              <span key={s.label} className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            {goal && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-px w-3 border-t border-dashed border-[var(--ink-mute)]" />
                {goal.label ?? fmt(goal.value)}
              </span>
            )}
            <span className="ml-auto">{formatDate(dates[0])} – {formatDate(dates[dates.length - 1])}</span>
          </>
        )}
      </div>
    </div>
  )
}

/** Splits a coordinate list at the gaps, so a missing day breaks the line. */
function segments(coords: ({ x: number; y: number } | null)[]): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = []
  let run: { x: number; y: number }[] = []
  for (const c of coords) {
    if (c) run.push(c)
    else {
      if (run.length > 1) out.push(run)
      run = []
    }
  }
  if (run.length > 1) out.push(run)
  return out
}

function indexFromEvent(e: React.PointerEvent<SVGSVGElement>, count: number): number | null {
  if (count === 0) return null
  const rect = e.currentTarget.getBoundingClientRect()
  // The SVG scales to the container, so the pointer has to be mapped back into
  // viewBox units before it can be turned into an index.
  const vx = ((e.clientX - rect.left) / rect.width) * W
  const plotW = W - PAD_X * 2 - GUTTER
  const ratio = (vx - PAD_X) / plotW
  return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))))
}
