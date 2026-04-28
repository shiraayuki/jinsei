import { forwardRef, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, className = '', ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-gray-600 dark:text-zinc-400">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={`h-11 rounded-xl border border-gray-300 bg-white px-3 text-gray-900 placeholder-gray-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 ${className}`}
      />
      {error && <span className="text-xs text-red-500 dark:text-red-400">{error}</span>}
    </div>
  )
})
