import { type HTMLAttributes, type ReactNode } from 'react'
import { moduleColor, type ModuleKey } from '../../lib/modules'

/**
 * The one card in the app.
 *
 * It replaced seven near-identical implementations — a glass gradient on the
 * dashboard, a bordered box in the shared component, and five local copies
 * written per screen. Everything visual comes from tokens, so a change to the
 * card is a change to one rule rather than a sweep through the pages.
 */
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`card ${className}`} />
}

interface SectionProps {
  /** Decides the colour of the icon plate and, downstream, of the section's data. */
  module: ModuleKey
  title: string
  icon: ReactNode
  /** What is stored for the day, shown next to the title. */
  summary?: string
  action?: ReactNode
  children: ReactNode
}

/** A card with a titled head: the shape every section and metric block uses. */
export function CardSection({ module, title, icon, summary, action, children }: SectionProps) {
  return (
    <Card className="p-4">
      {/* Health draws a card's subject as a coloured word with its glyph, not
          as a plate: the colour is the title's, and the icon rides with it. */}
      <div className="mb-3 flex items-center gap-1.5">
        <span style={{ color: moduleColor[module] }}>{icon}</span>
        <h2 className="text-meta font-semibold" style={{ color: moduleColor[module] }}>{title}</h2>
        {summary && <span className="ml-auto truncate text-meta text-ink-mute">{summary}</span>}
        {action}
      </div>
      {children}
    </Card>
  )
}
