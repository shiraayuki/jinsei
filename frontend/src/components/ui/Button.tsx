import { type ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/60',
  secondary: 'bg-zinc-800 hover:bg-zinc-700/80 text-zinc-100 border border-zinc-700/60',
  ghost: 'hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-100',
  danger: 'bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-900/40',
}

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-sm font-semibold',
}

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
