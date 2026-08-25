import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RangeTabs } from '../../components/ui/RangeTabs'
import { useRange } from '../../lib/useRange'
import { OverviewSection } from './sections/OverviewSection'
import { BodySection } from './sections/BodySection'
import { SleepSection } from './sections/SleepSection'
import { FoodSection } from './sections/FoodSection'
import { TrainingSection } from './sections/TrainingSection'
import { HabitsSection } from './sections/HabitsSection'

const TABS = ['overview', 'body', 'sleep', 'food', 'training', 'habits'] as const
type Tab = (typeof TABS)[number]

function storedTab(): Tab {
  try {
    const value = localStorage.getItem('jinsei.metrics.tab')
    return TABS.includes(value as Tab) ? (value as Tab) : 'overview'
  } catch {
    return 'overview'
  }
}

/**
 * One area at a time, with the controls folded into the header.
 *
 * The page used to open with four rows before any data: a title, a row of range
 * chips and two rows of area chips. All three jobs now share the header line —
 * the current area is the title and opens the list when tapped, the range sits
 * next to it — so a chart is the first thing on the screen.
 */
export function MetricsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useRange('metrics', 30)
  const [tab, setTab] = useState<Tab>(storedTab)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('jinsei.metrics.tab', tab)
    } catch {
      /* the tab is a convenience, not state we owe anyone */
    }
  }, [tab])

  function choose(next: Tab) {
    setTab(next)
    setPicking(false)
  }

  return (
    <div>
      <header className="sticky top-0 z-20 bg-surface/95 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4">
          {/* The menu is positioned against this wrapper and taken out of the
              flow, so opening it lays the list over the first card instead of
              pushing the whole page down. */}
          <div className="relative">
            <button
              onClick={() => setPicking(v => !v)}
              aria-expanded={picking}
              aria-haspopup="menu"
              className="-ml-2 flex items-center gap-1 rounded-chip px-2 py-1.5 transition-colors hover:bg-raised"
            >
              <h1 className="text-title font-bold tracking-tight text-ink">{t(`metrics.tabs.${tab}`)}</h1>
              <ChevronDown
                size={16}
                strokeWidth={2}
                className={`text-ink-mute transition-transform ${picking ? 'rotate-180' : ''}`}
              />
            </button>

            {picking && (
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-1 min-w-44 rounded-card border border-line bg-surface p-1 shadow-[var(--card-shadow)]"
              >
                {TABS.map(key => (
                  <button
                    key={key}
                    role="menuitem"
                    onClick={() => choose(key)}
                    className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-body transition-colors hover:bg-raised"
                  >
                    <span className={key === tab ? 'font-medium text-ink' : 'text-ink-soft'}>
                      {t(`metrics.tabs.${key}`)}
                    </span>
                    {key === tab && <Check size={15} className="ml-auto shrink-0 text-accent" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto">
            <RangeTabs compact value={days} onChange={setDays} />
          </div>
        </div>
      </header>

      {/* Tapping anywhere outside closes the menu. It sits above the page but
          below the menu itself, and the header stays live while it is open. */}
      {picking && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setPicking(false)}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}

      <div className="space-y-3 p-4">
        {tab === 'overview' && <OverviewSection days={days} />}
        {tab === 'body' && <BodySection days={days} />}
        {tab === 'sleep' && <SleepSection days={days} />}
        {tab === 'food' && <FoodSection days={days} />}
        {tab === 'training' && <TrainingSection days={days} />}
        {tab === 'habits' && <HabitsSection days={days} />}
      </div>
    </div>
  )
}
