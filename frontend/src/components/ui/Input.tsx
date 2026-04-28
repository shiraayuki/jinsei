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
      {label && <label className="text-sm text-zinc-400">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={`h-11 rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 ${className}`}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
})
