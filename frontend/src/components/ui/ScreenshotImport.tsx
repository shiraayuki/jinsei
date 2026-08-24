import { useRef, useState } from 'react'
import { ImageUp, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useImportStatus, useScreenshotImport } from '../../features/import/hooks'
import type { ImportDraft, ImportKind } from '../../features/import/api'
import { prepareImage } from '../../lib/image'

interface Props<F> {
  kind: ImportKind
  /** The day the form is editing. */
  date: string
  /** Called with the numbers read off the screenshot, to seed the form. */
  onApply: (fields: F) => void
  /** Offered when the screenshot turns out to be from another day. */
  onSelectDate?: (date: string) => void
}

/**
 * Reads a screenshot of Sleep Cycle or FatSecret into the form below it.
 * Nothing is saved: the fields are filled in and the normal save button still
 * has to be pressed, so a misread number is caught before it reaches the day.
 */
export function ScreenshotImport<F>({ kind, date, onApply, onSelectDate }: Props<F>) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const { data: status } = useImportStatus()
  const importer = useScreenshotImport<F>()
  const [draft, setDraft] = useState<ImportDraft<F> | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  // Without a key on the server the button would only ever produce an error,
  // so it stays out of the way entirely.
  if (!status?.configured) return null

  async function handleFile(file: File) {
    setDraft(null)
    setLocalError(null)
    let prepared
    try {
      prepared = await prepareImage(file)
    } catch {
      setLocalError(t('import.unreadable'))
      return
    }
    importer.mutate(
      { kind, date, ...prepared },
      {
        onSuccess: result => {
          setDraft(result)
          onApply(result.fields)
        },
      },
    )
  }

  const otherDay = draft?.date != null && draft.date !== date

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          // Cleared so picking the same file twice fires a change again.
          e.target.value = ''
          if (file) void handleFile(file)
        }}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={importer.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-line-strong py-2.5 text-meta font-medium text-ink-mute hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
      >
        {importer.isPending
          ? <><Loader2 size={14} className="animate-spin" /> {t('import.reading')}</>
          : <><ImageUp size={14} /> {t('import.button')}</>}
      </button>

      {localError && (
        <p className="text-meta text-bad">{localError}</p>
      )}

      {importer.isError && (
        <p className="text-meta text-bad">
          {(importer.error as Error).message || t('import.failed')}
        </p>
      )}

      {draft && (
        <div className="space-y-1 rounded-control bg-accent/5 px-3 py-2">
          <p className="text-meta text-accent">{t('import.applied')}</p>

          {draft.lowConfidence.length > 0 && (
            <p className="text-meta text-warn">
              {t('import.uncertain', {
                fields: draft.lowConfidence
                  .map(f => t(`import.fields.${f}`, { defaultValue: f }))
                  .join(', '),
              })}
            </p>
          )}

          {draft.warnings.map(w => (
            <p key={w} className="text-meta text-warn">{w}</p>
          ))}

          {otherDay && (
            <p className="text-meta text-warn">
              {t('import.otherDay', { date: draft.date })}{' '}
              {onSelectDate && (
                <button
                  type="button"
                  onClick={() => onSelectDate(draft.date!)}
                  className="underline hover:text-warn"
                >
                  {t('import.switchDay')}
                </button>
              )}
            </p>
          )}

          {draft.notes && (
            <p className="text-meta text-ink-mute">{draft.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}
