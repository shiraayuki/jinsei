import type { ReactNode } from 'react'

interface Props {
  label: string
  icon?: ReactNode
  /** Duration in minutes, or null when nothing has been entered yet. */
  minutes: number | null
  onChange: (minutes: number | null) => void
}

/**
 * Hours and minutes as two number fields. A duration is what Sleep Cycle
 * reports, and entering "7 h 20" is quicker on a phone than deriving it from
 * two clock times.
 */
export function DurationField({ label, icon, minutes, onChange }: Props) {
  const hours = minutes == null ? '' : String(Math.floor(minutes / 60))
  const mins = minutes == null ? '' : String(minutes % 60)

  function update(nextHours: string, nextMins: string) {
    if (nextHours === '' && nextMins === '') {
      onChange(null)
      return
    }
    const h = Math.min(24, Math.max(0, Number(nextHours) || 0))
    const m = Math.min(59, Math.max(0, Number(nextMins) || 0))
    onChange(h * 60 + m)
  }

  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500">
        {icon} {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            placeholder="–"
            value={hours}
            onChange={e => update(e.target.value, mins)}
            className="w-full min-w-0 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
          />
          <span className="text-xs text-gray-400 dark:text-zinc-500">h</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-gray-100 dark:bg-zinc-800 px-3 py-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            step={5}
            placeholder="–"
            value={mins}
            onChange={e => update(hours, e.target.value)}
            className="w-full min-w-0 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
          />
          <span className="text-xs text-gray-400 dark:text-zinc-500">min</span>
        </div>
      </div>
    </div>
  )
}
