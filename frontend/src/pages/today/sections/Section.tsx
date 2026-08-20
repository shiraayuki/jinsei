import type { ReactNode } from 'react'

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

export function SaveButton({ pending, disabled, label }: { pending: boolean; disabled?: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
    >
      {label}
    </button>
  )
}
