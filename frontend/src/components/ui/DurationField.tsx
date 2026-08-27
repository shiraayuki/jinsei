import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  label: string
  icon?: ReactNode
  /** Duration in minutes, or null when nothing has been entered yet. */
  minutes: number | null
  onChange: (minutes: number | null) => void
}

function split(total: number | null) {
  if (total == null) return { h: '', m: '' }
  return { h: String(Math.floor(total / 60)), m: String(total % 60) }
}

/**
 * Hours and minutes as two number fields. A duration is what Sleep Cycle
 * reports, and entering "7 h 20" is quicker on a phone than deriving it from
 * two clock times.
 *
 * What is typed is kept as text and only turned into a number on the way out.
 * Rewriting the fields from the parsed value on every keystroke made them
 * impossible to type in: clearing one field refilled it with "0", and a
 * half-typed number was clamped before it was finished.
 */
export function DurationField({ label, icon, minutes, onChange }: Props) {
  const [text, setText] = useState(() => split(minutes))

  // Follow the value when it is changed from outside — a screenshot import, or
  // switching to another day — without disturbing what is being typed.
  const own = useRef<number | null>(minutes)
  useEffect(() => {
    if (minutes === own.current) return
    own.current = minutes
    setText(split(minutes))
  }, [minutes])

  function update(next: { h: string; m: string }) {
    setText(next)

    if (next.h.trim() === '' && next.m.trim() === '') {
      own.current = null
      onChange(null)
      return
    }

    // Minutes past 59 carry into hours, so "95" in the minute field is a
    // perfectly good way to say an hour and a half.
    const total = Math.max(0, Math.min(1440, (Number(next.h) || 0) * 60 + (Number(next.m) || 0)))
    own.current = total
    onChange(total)
  }

  /**
   * Tidies "70" minutes into "1 h 10" once the field is left, never while
   * typing. Only the carry is rewritten: filling an empty field with "0"
   * because the other one has a value is what made these impossible to type
   * in to begin with.
   */
  function normalise() {
    if (text.m.trim() === '' || Number(text.m) <= 59) return
    setText(split(own.current))
  }

  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-meta text-ink-mute">
        {icon} {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-control border border-line bg-raised px-3 py-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            step={1}
            placeholder="–"
            value={text.h}
            onChange={e => update({ h: e.target.value, m: text.m })}
            onBlur={normalise}
            className="w-full min-w-0 bg-transparent text-body text-ink outline-none"
          />
          <span className="text-meta text-ink-mute">h</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-control border border-line bg-raised px-3 py-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="–"
            value={text.m}
            onChange={e => update({ h: text.h, m: e.target.value })}
            onBlur={normalise}
            className="w-full min-w-0 bg-transparent text-body text-ink outline-none"
          />
          <span className="text-meta text-ink-mute">min</span>
        </div>
      </div>
    </div>
  )
}
