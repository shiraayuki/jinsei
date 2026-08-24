import { type ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary: 'bg-accent hover:brightness-110 text-white shadow-md ',
  secondary: 'bg-raised hover:bg-line text-ink-soft border border-line',
  ghost: 'hover:bg-raised text-ink-mute hover:text-ink',
  danger: 'bg-bad/10 hover:bg-bad/20 text-bad border border-bad/30',
}

const sizes = {
  sm: 'h-9 px-3 text-meta',
  md: 'h-10 px-4 text-body',
  lg: 'h-12 px-6 text-body font-semibold',
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-all disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
