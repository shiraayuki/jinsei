import { useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { NutritionSection } from './sections/NutritionSection'
import { ActivitySection } from './sections/ActivitySection'
import { SleepSection } from './sections/SleepSection'
import { WeightSection } from './sections/WeightSection'
import { WellbeingSection } from './sections/WellbeingSection'
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
        className="sticky top-0 z-10 flex items-center gap-2 bg-white/95 dark:bg-zinc-950/95 px-3 py-2 backdrop-blur-xl"
      >
        <button
          onClick={() => setDate(d => shiftIso(d, -1))}
          aria-label={t('today.previousDay')}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[15px] font-bold tracking-tight text-gray-900 dark:text-zinc-50">
            {isToday ? t('today.title') : label}
          </p>
          {!isToday && (
            <button
              onClick={() => setDate(todayIso())}
              className="text-[11px] text-indigo-400 hover:text-indigo-300"
            >
              {t('today.backToToday')}
            </button>
          )}
        </div>

        <button
          onClick={() => summary.mutate({ scope: 'day', date })}
          disabled={summary.isPending}
          aria-label={t('today.exportTitle')}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
        >
          <FileText size={17} />
        </button>

        <button
          onClick={() => summary.mutate({ scope: 'week', date })}
          disabled={summary.isPending}
          aria-label={t('today.exportWeekTitle')}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
        >
          <CalendarRange size={17} />
        </button>

        <button
          onClick={() => setDate(d => shiftIso(d, 1))}
          disabled={isToday}
          aria-label={t('today.nextDay')}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </header>

      {summary.isError && (
        <p className="px-4 pt-3 text-xs text-rose-500 dark:text-rose-400">{(summary.error as Error).message}</p>
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
        <SleepSection date={date} />
        <WeightSection date={date} />
        <WellbeingSection date={date} />
      </div>
    </div>
  )
}
