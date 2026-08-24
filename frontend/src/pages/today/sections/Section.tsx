import { useEffect, useState, type ReactNode } from 'react'
import { Check, CloudOff, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QueuedOfflineError } from '../../../lib/api'

interface Props {
  title: string
  icon: ReactNode
  /** Short summary of what is stored for the day, shown next to the title. */
  summary?: string
  children: ReactNode
}

export function Section({ title, icon, summary, children }: Props) {
  return (
    <section className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{title}</h2>
        {summary && (
          <span className="ml-auto truncate text-xs text-gray-400 dark:text-zinc-500">{summary}</span>
        )}
      </div>
      {children}
    </section>
  )
}

interface StatusProps {
  pending: boolean
  /** Set once a write has come back, so the confirmation can fade out again. */
  savedAt?: number
  error?: Error | null
}

/**
 * Replaces the save button. Autosave is invisible when it works, so this only
 * speaks up while a write is in flight, briefly after one lands, and whenever
 * one did not land at all.
 */
export function SaveStatus({ pending, savedAt, error }: StatusProps) {
  const { t } = useTranslation()
  // The confirmation is shown for a moment and then dismissed by its own
  // timer, so what is stored is which save has already been acknowledged.
  const [dismissed, setDismissed] = useState<number | null>(null)
  const showSaved = savedAt != null && dismissed !== savedAt

  useEffect(() => {
    if (!savedAt) return
    const timer = setTimeout(() => setDismissed(savedAt), 2000)
    return () => clearTimeout(timer)
  }, [savedAt])

  if (error) {
    // A write that only failed to reach the server is parked in the outbox and
    // is not the user's problem to solve.
    const queued = error instanceof QueuedOfflineError
    return (
      <p className={`flex items-center gap-1.5 text-xs ${queued ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500 dark:text-rose-400'}`}>
        {queued ? <CloudOff size={13} /> : null}
        {queued ? t('outbox.queued') : error.message || t('common.saveFailed')}
      </p>
    )
  }

  if (pending) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
        <Loader2 size={13} className="animate-spin" /> {t('common.saving')}
      </p>
    )
  }

  if (showSaved) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Check size={13} /> {t('common.saved')}
      </p>
    )
  }

  // Holds the row's height so the form does not jump as the status appears.
  return <p className="text-xs text-transparent select-none">&nbsp;</p>
}
