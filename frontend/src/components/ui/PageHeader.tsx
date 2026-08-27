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
    <header
      className="sticky top-0 z-10 flex h-11 items-center justify-between gap-2 px-4 hairline-b relative"
      style={{
        // The navigation bar is material, not a panel: it takes the colour of
        // whatever scrolls under it and blurs it.
        background: 'color-mix(in srgb, var(--ground) 80%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      }}
    >
      {back && (
        <button
          onClick={() => navigate(-1)}
          aria-label="Zurück"
          className="-ml-2 flex h-11 w-11 items-center justify-center text-accent"
        >
          <ArrowLeft size={22} strokeWidth={2.2} />
        </button>
      )}
      {/* The title is centred on the bar itself, not on the space the buttons
          leave over — a navigation bar with one button on the right would
          otherwise carry its title slightly to the left of centre. It is taken
          out of the flow so the buttons keep their sides. */}
      <h1 className="pointer-events-none absolute inset-x-14 text-center text-body font-semibold text-ink">
        {title}
      </h1>
      <span aria-hidden />
      {action}
    </header>
  )
}
