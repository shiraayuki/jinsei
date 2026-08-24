import { useEffect, useRef } from 'react'

interface Options {
  /** How long to wait after the last keystroke before writing. */
  delayMs?: number
  /**
   * Whether the current value may be written at all. A form that is
   * mid-edit and inconsistent stays unsaved until it makes sense again.
   */
  enabled?: boolean
}

/**
 * Writes the day whenever it stops changing, so nothing has to be confirmed
 * with a button.
 *
 * Every write in this app is an upsert keyed on the date, so saving twice
 * leaves the same row and a debounce is all that separates "typing" from
 * "done". The value seeded from the server is remembered as already-saved,
 * which keeps opening a day from writing it straight back.
 */
export function useAutosave<T>(value: T, save: (value: T) => void, opts?: Options) {
  const delay = opts?.delayMs ?? 800
  const enabled = opts?.enabled ?? true

  const serialized = JSON.stringify(value)
  const lastSaved = useRef(serialized)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Read through refs so the debounce below depends only on the serialized
  // value: a fresh save callback on every render must not restart the timer.
  // Declared first so it is refreshed before the effects that read it.
  const latest = useRef({ value, save, enabled })
  useEffect(() => {
    latest.current = { value, save, enabled }
  })

  useEffect(() => {
    if (serialized === lastSaved.current) return

    timer.current = setTimeout(() => {
      timer.current = null
      if (!latest.current.enabled) return
      lastSaved.current = serialized
      latest.current.save(latest.current.value)
    }, delay)

    return () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }
  }, [serialized, delay])

  // Leaving the page or switching away mid-debounce would otherwise drop the
  // last edit, which is exactly the edit the user just made.
  useEffect(() => {
    function flush() {
      if (!timer.current) return
      clearTimeout(timer.current)
      timer.current = null
      const current = JSON.stringify(latest.current.value)
      if (current === lastSaved.current || !latest.current.enabled) return
      lastSaved.current = current
      latest.current.save(latest.current.value)
    }

    function onHide() {
      if (document.visibilityState === 'hidden') flush()
    }

    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [])
}
