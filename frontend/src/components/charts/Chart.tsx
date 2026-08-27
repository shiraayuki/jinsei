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
  /**
   * Stack this bar series on top of the others carrying the same key, in the
   * order they are given. Parts of one whole — the phases of a night — are a
   * stack: side by side they say how each part moved, stacked they also say
   * what the whole was.
   */
  stack?: string
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
/** Room under the plot for the date labels on the x axis. */
const PAD_BOTTOM = 16
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
      const values = s.stack
        ? stackTotals(withData, s.stack)
        : s.points.map(p => p.value).filter((v): v is number => v != null)
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

  // A line is a reading at a moment and sits on the edge; a bar is a whole day
  // and owns a slice of the axis. A chart of bars therefore hands each day a
  // slot and centres it, which is also what lets the bars fill the width
  // instead of standing as hairlines in the middle of it.
  const allBars = withData.every(s => s.kind === 'bar')
  const slot = plotW / Math.max(count, 1)
  const x = (i: number) =>
    allBars
      ? PAD_X + slot * (i + 0.5)
      : PAD_X + (count > 1 ? (i / (count - 1)) * plotW : plotW / 2)
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
  // The unit belongs to whatever the grid is scaled to, which is the first
  // series; it is written once, on the top label, rather than on all of them.
  const unit = withData[0].unit ?? ''
  // Only a gap between the days, not a gap the bars sit in: a hairline is the
  // right width for ninety days and the wrong one for seven.
  const barWidth = Math.max(1, allBars ? slot - Math.min(3, slot * 0.18) : slot * 0.72)

  // Three dates under the plot — first, middle, last. More than that overlaps
  // on a phone, fewer leaves the middle of the chart unplaceable.
  const ticks = count < 2
    ? [0]
    : count < 4
      ? [0, count - 1]
      : [0, Math.floor((count - 1) / 2), count - 1]

  // The readout floats over the plot rather than sitting under it: the eye is
  // already at the point it is asking about, and a fixed footer readout made
  // the legend jump between two texts on every touch. It is pushed to whichever
  // half of the chart the finger is not on, since a card under the hand says
  // nothing.
  const readout = hover != null && dates[hover] ? { index: hover, ratio: x(hover) / W } : null

  return (
    <div className="relative">
      {/*
        `touch-pan-y` and not `touch-none`: a finger dragged sideways scrubs the
        chart, one dragged down still scrolls the page. A chart that eats the
        scroll is a trap on a phone. A mouse reads on hover, a finger only while
        it is on the glass.
      */}
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-pan-y select-none overflow-visible"
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        onPointerDown={e => setHover(indexFromEvent(e, count, allBars))}
        onPointerMove={e => (e.pointerType === 'mouse' || e.buttons > 0) && setHover(indexFromEvent(e, count, allBars))}
        // Only a mouse leaving clears the reading. A finger lifting does not:
        // the point of tapping a chart is to then look at what it said.
        onPointerLeave={e => e.pointerType === 'mouse' && setHover(null)}
        onContextMenu={e => e.preventDefault()}
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
              {fmt(v)}{v === gridValues[gridValues.length - 1] ? unit : ''}
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
            // What the series below this one in the same stack already used up,
            // per day. Zero for a bar that stands on its own.
            const under = s.stack ? stackedBelow(withData, s) : null

            return (
              <g key={s.label}>
                {s.points.map((p, i) => {
                  const floor = under ? y(under[i]) : baseline
                  const top = p.value == null ? floor : y((under?.[i] ?? 0) + p.value)
                  return (
                  <rect
                    key={p.date}
                    x={x(i) - barWidth / 2}
                    y={p.value == null ? floor - 1.5 : Math.min(top, floor)}
                    width={barWidth}
                    height={p.value == null ? 1.5 : Math.max(1.5, Math.abs(floor - top))}
                    rx={s.stack ? 0 : Math.min(2, barWidth / 2)}
                    // A missing day is a hairline stub in the line colour, so a
                    // gap reads as a gap rather than as a zero.
                    style={{ fill: p.value == null ? 'var(--line-strong)' : s.color, fillOpacity: p.value == null ? 1 : 0.85 }}
                  />
                  )
                })}
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

        {/* The x axis. Anchored at the ends so the first and last labels stay
            inside the drawing rather than hanging off it. */}
        {ticks.map(i => (
          <text
            key={dates[i]}
            x={x(i)}
            y={height - 3}
            textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'}
            className="fill-[var(--ink-faint)]"
            style={{ fontSize: 9 }}
          >
            {formatDate(dates[i])}
          </text>
        ))}

        {hover != null && dates[hover] && (
          <g>
            <line
              x1={x(hover)} x2={x(hover)} y1={PAD_TOP} y2={PAD_TOP + plotH}
              strokeWidth="1" style={{ stroke: 'var(--ink-faint)' }}
            />
            {withData.map(s => {
              const value = s.points[hover]?.value
              if (value == null) return null
              return (
                <circle
                  key={s.label}
                  cx={x(hover)}
                  cy={yFor(s.scaleWith ?? s.label)(value)}
                  r="3.5"
                  strokeWidth="2"
                  style={{ fill: s.color, stroke: 'var(--surface)' }}
                />
              )
            })}
          </g>
        )}
      </svg>

      {readout && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-control border border-[var(--line)] bg-surface/95 px-2 py-1 text-label text-ink shadow-lg backdrop-blur-sm tabular"
          style={
            // Left half read, card on the right; right half read, card on the
            // left. On a phone that is the difference between a readout and a
            // fingertip.
            readout.ratio < 0.5 ? { right: 0 } : { left: 0 }
          }
        >
          <p className="whitespace-nowrap text-ink-soft">{formatDate(dates[readout.index])}</p>
          {withData.map(s => (
            <p key={s.label} className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="text-ink-mute">{s.label}</span>
              <span className="ml-auto font-semibold">
                {s.points[readout.index]?.value != null
                  ? `${fmt(s.points[readout.index].value!)}${s.unit ?? ''}`
                  : '–'}
              </span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-label text-ink-faint tabular">
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
      </div>
    </div>
  )
}

/** Every day's stacked total, for the series sharing one stack key. */
function stackTotals(series: ChartSeries[], stack: string): number[] {
  const parts = series.filter(s => s.stack === stack)
  const length = Math.max(...parts.map(s => s.points.length))
  const totals: number[] = []
  for (let i = 0; i < length; i++) {
    const day = parts.map(s => s.points[i]?.value).filter((v): v is number => v != null)
    if (day.length > 0) totals.push(day.reduce((a, b) => a + b, 0))
  }
  return totals
}

/** Per day, what the series stacked under this one add up to. */
function stackedBelow(series: ChartSeries[], of: ChartSeries): number[] {
  const parts = series.filter(s => s.stack === of.stack)
  const below = parts.slice(0, parts.indexOf(of))
  return of.points.map((_, i) => below.reduce((sum, s) => sum + (s.points[i]?.value ?? 0), 0))
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

function indexFromEvent(
  e: React.PointerEvent<SVGSVGElement>,
  count: number,
  allBars: boolean,
): number | null {
  if (count === 0) return null
  const rect = e.currentTarget.getBoundingClientRect()
  // The SVG scales to the container, so the pointer has to be mapped back into
  // viewBox units before it can be turned into an index.
  const vx = ((e.clientX - rect.left) / rect.width) * W
  const plotW = W - PAD_X * 2 - GUTTER
  const ratio = (vx - PAD_X) / plotW
  // Bars own a slot, so the day under the finger is the slot it landed in;
  // points sit on the edges, so the nearest one wins.
  const index = allBars ? Math.floor(ratio * count) : Math.round(ratio * (count - 1))
  return Math.max(0, Math.min(count - 1, index))
}
