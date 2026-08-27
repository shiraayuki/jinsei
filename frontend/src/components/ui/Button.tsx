import { type ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

/*
 * Filled, tinted, plain and destructive — the four button styles iOS actually
 * has. A tinted button is the accent at low opacity with the accent as its
 * label, never a grey box with a border.
 */
const variants = {
  primary: 'bg-accent text-white active:opacity-80',
  secondary: 'bg-accent-soft text-accent active:opacity-70',
  ghost: 'text-accent active:opacity-50',
  danger: 'bg-bad/12 text-bad active:opacity-70',
}

const sizes = {
  sm: 'h-8 px-3.5 text-meta',
  md: 'h-11 px-5 text-body',
  lg: 'h-12 px-6 text-body',
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-opacity disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
