import { type HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-2xl border border-gray-200 bg-white dark:border-zinc-800/80 dark:bg-zinc-900 ${className}`}
    />
  )
}
