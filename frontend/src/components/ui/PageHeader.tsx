import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface Props {
  title: string
  back?: boolean
  action?: React.ReactNode
}

export function PageHeader({ title, back, action }: Props) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-surface/95 px-4 backdrop-blur-xl">
      {back && (
        <button
          onClick={() => navigate(-1)}
          aria-label="Zurück"
          className="-m-2 flex h-10 w-10 items-center justify-center text-ink-mute hover:text-ink transition-colors"
        >
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
      )}
      <h1 className="flex-1 text-title font-bold tracking-tight text-ink">{title}</h1>
      {action}
    </header>
  )
}
