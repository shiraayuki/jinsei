import { type ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variants = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/60',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 dark:text-zinc-100 dark:border-zinc-700/60',
  ghost: 'hover:bg-gray-100 text-gray-500 hover:text-gray-900 dark:hover:bg-zinc-800/60 dark:text-zinc-400 dark:hover:text-zinc-100',
  danger: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/60 dark:text-red-400 dark:border-red-900/40',
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
