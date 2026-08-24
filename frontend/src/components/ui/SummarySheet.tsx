import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Shows the generated text and copies it on a direct tap. Safari only allows a
 * clipboard write inside a user gesture, and the fetch that produces the text
 * breaks that chain — so the copy happens here, from a button the user presses
 * once the text is already in hand. The textarea is the fallback for when the
 * clipboard is unavailable.
 */
export function SummarySheet({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFailed(true)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-t-card bg-surface"
        style={{
          maxHeight: 'calc(90dvh - var(--bottom-nav-total))',
          marginBottom: 'var(--bottom-nav-total)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-body font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-9 w-9 items-center justify-center text-ink-mute hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <textarea
            readOnly
            value={text}
            onFocus={e => e.currentTarget.select()}
            rows={14}
            className="w-full resize-none rounded-control bg-raised p-3 font-mono text-meta leading-relaxed text-ink outline-none"
          />
          {failed && (
            <p className="mt-2 text-meta text-warn">{t('today.copyFailed')}</p>
          )}
        </div>

        <div className="flex-shrink-0 px-4 pb-safe">
          <button
            onClick={copy}
            className="flex w-full items-center justify-center gap-2 rounded-control bg-accent py-3 text-body font-semibold text-white transition hover:brightness-110"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t('today.copied') : t('today.copy')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
