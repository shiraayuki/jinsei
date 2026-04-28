import { type HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-2xl border border-zinc-800 bg-zinc-900 ${className}`}
    />
  )
}
