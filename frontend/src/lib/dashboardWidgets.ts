import { useCallback, useEffect, useState } from 'react'

/**
 * Which cards the dashboard shows, and in what order.
 *
 * Stored in the browser rather than on the server: it is one person's reading
 * order on one phone, it has to survive a reload and nothing more. Sending it
 * through the API would buy cross-device sync at the cost of a table, a
 * migration and a round trip before the first paint.
 *
 * Reordering is two arrows rather than drag and drop — with six cards, dragging
 * is a gesture to learn for a job that two taps already do.
 */
export const WIDGETS = ['habits', 'today', 'drinks', 'weight', 'sleep', 'workout'] as const
export type WidgetKey = (typeof WIDGETS)[number]

const STORAGE_KEY = 'jinsei.dashboard.widgets'

export interface WidgetLayout {
  key: WidgetKey
  visible: boolean
}

const DEFAULT_LAYOUT: WidgetLayout[] = WIDGETS.map(key => ({
  key,
  // Weight and sleep start hidden: the four tiles under "today" already carry
  // both numbers, and a dashboard that shows everything shows nothing.
  visible: key !== 'weight' && key !== 'sleep',
}))

function read(): WidgetLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT

    const stored = parsed.filter(
      (row): row is WidgetLayout =>
        typeof row === 'object' && row !== null &&
        WIDGETS.includes((row as WidgetLayout).key) &&
        typeof (row as WidgetLayout).visible === 'boolean',
    )
    // A widget added in a later release is unknown to a stored layout, so it is
    // appended with its default rather than silently dropped.
    const missing = DEFAULT_LAYOUT.filter(d => !stored.some(s => s.key === d.key))
    return [...stored, ...missing]
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function useWidgetLayout() {
  const [layout, setLayout] = useState<WidgetLayout[]>(read)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    } catch {
      /* the layout is a convenience; losing it costs a reorder, not data */
    }
  }, [layout])

  const move = useCallback((key: WidgetKey, direction: -1 | 1) => {
    setLayout(current => {
      const index = current.findIndex(w => w.key === key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }, [])

  const toggle = useCallback((key: WidgetKey) => {
    setLayout(current => current.map(w => (w.key === key ? { ...w, visible: !w.visible } : w)))
  }, [])

  const reset = useCallback(() => setLayout(DEFAULT_LAYOUT), [])

  return { layout, move, toggle, reset }
}
