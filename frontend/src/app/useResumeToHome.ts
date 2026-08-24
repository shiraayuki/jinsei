import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clearHidden, hiddenFor, isStandalone, markHidden, RESUME_AFTER_MS } from '../lib/coldStart'

/**
 * Sends the app back to the dashboard when it is opened again after a long
 * absence. On iOS a backgrounded PWA is resumed rather than restarted, so
 * without this the app stays on whichever tab it was left on for days.
 *
 * Short trips away — checking a message, copying a number out of another app —
 * keep the page, which is the whole point of a resume.
 */
export function useResumeToHome() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isStandalone()) return

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        markHidden()
        return
      }

      const away = hiddenFor()
      clearHidden()
      if (away == null || away < RESUME_AFTER_MS) return
      if (window.location.pathname === '/') return
      navigate('/', { replace: true })
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
    // location is not read here, but re-running on navigation keeps the closure
    // from pinning a stale navigate across route changes.
  }, [navigate, location.pathname])
}
