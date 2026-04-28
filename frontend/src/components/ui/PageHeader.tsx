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
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-zinc-950/80 px-4 backdrop-blur-xl">
      {back && (
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-zinc-100 transition-colors">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
      )}
      <h1 className="flex-1 text-[17px] font-bold tracking-tight text-zinc-50">{title}</h1>
      {action}
    </header>
  )
}
