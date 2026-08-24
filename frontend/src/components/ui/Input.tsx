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
    <div className="flex min-w-0 flex-col gap-1">
      {label && <label className="text-meta text-ink-mute">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={`h-11 w-full min-w-0 rounded-control border border-line bg-surface px-3 text-ink placeholder-ink-faint outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/30 ${className}`}
      />
      {error && <span className="text-meta text-bad">{error}</span>}
    </div>
  )
})
