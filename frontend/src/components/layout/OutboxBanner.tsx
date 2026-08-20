import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { flush, subscribe } from '../../lib/offlineQueue'

/**
 * Says plainly that something is written but not yet sent, so a save that only
 * reached the outbox is never mistaken for one the server has.
 */
export function OutboxBanner() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [pending, setPending] = useState(0)
  const [sending, setSending] = useState(false)

  useEffect(() => subscribe(setPending), [])

  useEffect(() => {
    async function attempt() {
      setSending(true)
      try {
        if (await flush() > 0) await qc.invalidateQueries()
      } finally {
        setSending(false)
      }
    }

    // Try on the way in, and again whenever the device says it is back.
    void attempt()
    window.addEventListener('online', attempt)
    return () => window.removeEventListener('online', attempt)
  }, [qc])

  if (pending === 0) return null

  return (
    <button
      onClick={async () => {
        setSending(true)
        try {
          if (await flush() > 0) await qc.invalidateQueries()
        } finally {
          setSending(false)
        }
      }}
      className="flex w-full items-center gap-2 bg-amber-500/15 px-4 py-2 text-left text-xs text-amber-700 dark:text-amber-400"
    >
      {sending ? <RefreshCw size={13} className="animate-spin" /> : <CloudOff size={13} />}
      <span className="flex-1">{t('outbox.pending', { count: pending })}</span>
      <span className="font-medium">{t('outbox.retry')}</span>
    </button>
  )
}
