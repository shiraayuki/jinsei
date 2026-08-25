import type { ReactNode } from 'react'
import { CardSection } from '../../components/ui/Card'
import type { ModuleKey } from '../../lib/modules'

/** The card every metrics block sits in, so the page reads as one thing. */
export function Block({
  module,
  icon,
  title,
  summary,
  children,
}: {
  module: ModuleKey
  icon: ReactNode
  title: string
  summary?: string
  children: ReactNode
}) {
  return (
    <CardSection module={module} title={title} icon={icon} summary={summary}>
      <div className="space-y-3">{children}</div>
    </CardSection>
  )
}

/** What a block shows when the range holds nothing to show. */
export function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-meta text-ink-faint">{text}</p>
}
