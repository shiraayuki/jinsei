import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { NutritionSection } from './sections/NutritionSection'
import { ActivitySection } from './sections/ActivitySection'
import { SleepSection } from './sections/SleepSection'
import { WeightSection } from './sections/WeightSection'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function TodayPage() {
  const { t } = useTranslation()
  const [date, setDate] = useState(todayIso())

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
          onClick={() => setDate(d => shift(d, -1))}
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
          onClick={() => setDate(d => shift(d, 1))}
          disabled={isToday}
          aria-label={t('today.nextDay')}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </header>

      <div className="space-y-3 p-4">
        <NutritionSection date={date} />
        <ActivitySection date={date} />
        <SleepSection date={date} />
        <WeightSection date={date} />
      </div>
    </div>
  )
}
