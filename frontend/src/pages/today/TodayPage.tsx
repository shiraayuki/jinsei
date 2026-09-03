import { useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { NutritionSection } from './sections/NutritionSection'
import { ActivitySection } from './sections/ActivitySection'
import { SleepSection } from './sections/SleepSection'
import { WeightSection } from './sections/WeightSection'
import { NotesSection } from './sections/NotesSection'
import { DailyReportSection } from './sections/DailyReportSection'
import { SummarySheet } from '../../components/ui/SummarySheet'
import { useDaySummary } from '../../features/summary/hooks'
import { todayIso, shiftIso } from '../../lib/date'

export function TodayPage() {
  const { t } = useTranslation()
  const [date, setDate] = useState(todayIso())
  const summary = useDaySummary()

  const isToday = date === todayIso()
  const label = new Date(`${date}T00:00:00`).toLocaleDateString(dateLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 px-2 py-1.5 hairline-b"
        style={{
          background: 'color-mix(in srgb, var(--ground) 80%, transparent)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}
      >
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setDate(d => shiftIso(d, -1))}
            aria-label={t('today.previousDay')}
            className="flex h-11 w-11 items-center justify-center rounded-control text-accent active:opacity-40"
          >
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          <button
            onClick={() => summary.mutate({ scope: 'day', date })}
            disabled={summary.isPending}
            aria-label={t('today.exportTitle')}
            className="flex h-11 w-11 items-center justify-center rounded-control text-accent disabled:opacity-30 active:opacity-40"
          >
            <FileText size={19} strokeWidth={1.9} />
          </button>
        </div>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-body font-semibold text-ink">
            {isToday ? t('today.title') : label}
          </p>
          {!isToday && (
            <button
              onClick={() => setDate(todayIso())}
              className="text-meta text-accent hover:text-accent"
            >
              {t('today.backToToday')}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => summary.mutate({ scope: 'week', date })}
            disabled={summary.isPending}
            aria-label={t('today.exportWeekTitle')}
            className="flex h-11 w-11 items-center justify-center rounded-control text-accent disabled:opacity-30 active:opacity-40"
          >
            <CalendarRange size={19} strokeWidth={1.9} />
          </button>
          <button
            onClick={() => setDate(d => shiftIso(d, 1))}
            disabled={isToday}
            aria-label={t('today.nextDay')}
            className="flex h-11 w-11 items-center justify-center rounded-control text-accent disabled:opacity-25 active:opacity-40"
          >
            <ChevronRight size={22} strokeWidth={2.2} />
          </button>
        </div>

      </header>

      {summary.isError && (
        <p className="px-4 pt-3 text-meta text-bad">{(summary.error as Error).message}</p>
      )}

      {summary.data != null && (
        <SummarySheet
          title={summary.variables?.scope === 'week' ? t('today.exportWeekTitle') : t('today.exportTitle')}
          text={summary.data}
          onClose={() => summary.reset()}
        />
      )}

      <div className="space-y-3 p-4">
        <NutritionSection date={date} />
        <ActivitySection date={date} />
        <SleepSection date={date} onSelectDate={setDate} />
        <WeightSection date={date} />
        <NotesSection date={date} />
        <DailyReportSection date={date} />
      </div>
    </div>
  )
}
