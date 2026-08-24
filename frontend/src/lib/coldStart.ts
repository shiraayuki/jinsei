/**
 * The installed PWA is resumed at whatever URL it was left on, so launching it
 * from the home screen can land on any tab.
 *
 * There are two separate cases and neither one covers the other:
 *
 * 1. The app was killed and is started again. A script runs, so the URL can be
 *    rewritten before the router ever reads it — `resetColdStartRoute` below.
 * 2. The app was only backgrounded and is brought back. iOS runs no script at
 *    all here, so nothing at load time can help; the page simply becomes
 *    visible again on the tab it was left on. That is what `useResumeToHome`
 *    handles, by treating a long absence as a fresh start.
 */

const HIDDEN_AT = 'jinsei:hiddenAt'

/** How long the app has to have been away before coming back counts as a fresh start. */
export const RESUME_AFTER_MS = 30 * 60 * 1000

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Rewrites a cold start back to the dashboard before the router reads the
 * location. A reload (including the chunk-reload in main.tsx) keeps its page —
 * reloading is how the app recovers from a stale build, and throwing the user
 * to the dashboard for it would be its own bug.
 */
export function resetColdStartRoute() {
  if (!isStandalone()) return

  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  if (entry && entry.type === 'reload') return

  if (window.location.pathname === '/') return
  window.history.replaceState(null, '', '/')
}

export function markHidden() {
  try {
    sessionStorage.setItem(HIDDEN_AT, String(Date.now()))
  } catch {
    // Private mode and blocked storage both just mean no resume handling.
  }
}

/** How long the app has been in the background, or null when it never was. */
export function hiddenFor(): number | null {
  try {
    const raw = sessionStorage.getItem(HIDDEN_AT)
    if (!raw) return null
    const since = Number(raw)
    return Number.isFinite(since) ? Date.now() - since : null
  } catch {
    return null
  }
}

export function clearHidden() {
  try {
    sessionStorage.removeItem(HIDDEN_AT)
  } catch {
    // Nothing to clear if it could not be written in the first place.
  }
}
