import { useEffect, useState, type ReactNode } from 'react'
import { Check, CloudOff, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QueuedOfflineError } from '../../../lib/api'
import { CardSection } from '../../../components/ui/Card'
import type { ModuleKey } from '../../../lib/modules'

interface Props {
  /** Colours the section's icon; the forms inside take their cue from it too. */
  module: ModuleKey
  title: string
  icon: ReactNode
  /** Short summary of what is stored for the day, shown next to the title. */
  summary?: string
  children: ReactNode
}

export function Section({ module, title, icon, summary, children }: Props) {
  return (
    <CardSection module={module} title={title} icon={icon} summary={summary}>
      {children}
    </CardSection>
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
      <p className={`flex items-center gap-1.5 text-meta ${queued ? 'text-warn' : 'text-bad'}`}>
        {queued ? <CloudOff size={15} /> : null}
        {queued ? t('outbox.queued') : error.message || t('common.saveFailed')}
      </p>
    )
  }

  if (pending) {
    return (
      <p className="flex items-center gap-1.5 text-meta text-ink-faint">
        <Loader2 size={15} className="animate-spin" /> {t('common.saving')}
      </p>
    )
  }

  if (showSaved) {
    return (
      <p className="flex items-center gap-1.5 text-meta text-good">
        <Check size={15} /> {t('common.saved')}
      </p>
    )
  }

  // Holds the row's height so the form does not jump as the status appears.
  return <p className="text-meta text-transparent select-none">&nbsp;</p>
}
