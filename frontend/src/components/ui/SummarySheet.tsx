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
export function SummarySheet({ text, onClose }: { text: string; onClose: () => void }) {
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
        className="flex flex-col rounded-t-2xl bg-white dark:bg-zinc-900"
        style={{
          maxHeight: 'calc(90dvh - var(--bottom-nav-total))',
          marginBottom: 'var(--bottom-nav-total)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 dark:border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{t('today.exportTitle')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-9 w-9 items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100"
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
            className="w-full resize-none rounded-xl bg-gray-50 dark:bg-zinc-800 p-3 font-mono text-xs leading-relaxed text-gray-800 dark:text-zinc-200 outline-none"
          />
          {failed && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t('today.copyFailed')}</p>
          )}
        </div>

        <div className="flex-shrink-0 px-4 pb-safe">
          <button
            onClick={copy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
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
