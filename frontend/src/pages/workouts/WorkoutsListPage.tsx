import { Link } from 'react-router-dom'
import { RefreshCw, Dumbbell, ChevronRight, AlertCircle } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useWorkouts, useSyncStatus, useSyncWorkouts } from '../../features/workouts/hooks'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
}

export function WorkoutsListPage() {
  const { t } = useTranslation()
  const { data: workouts = [], isLoading } = useWorkouts()
  const { data: status } = useSyncStatus()
  const sync = useSyncWorkouts()

  const configured = status?.configured ?? true

  return (
    <div>
      <PageHeader
        title={t('nav.workouts')}
        action={
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending || !configured}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-2.5 text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={13} className={sync.isPending ? 'animate-spin' : undefined} />
            {t('workouts.sync')}
          </button>
        }
      />

      <div className="space-y-3 p-4">
        {!configured && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{t('workouts.syncNotConfigured')}</p>
          </div>
        )}

        {sync.isError && (
          <div className="flex items-start gap-2 rounded-2xl bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{(sync.error as Error).message}</p>
          </div>
        )}

        {sync.isSuccess && (
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            {t('workouts.syncResult', { added: sync.data.added, updated: sync.data.updated })}
          </p>
        )}

        {isLoading && <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">{t('common.loading')}</p>}

        {!isLoading && workouts.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Dumbbell size={28} className="text-gray-300 dark:text-zinc-700" />
            <p className="font-medium text-gray-500 dark:text-zinc-400">{t('workouts.empty')}</p>
            <p className="text-sm text-gray-400 dark:text-zinc-600">{t('workouts.emptyHint')}</p>
          </div>
        )}

        {workouts.map(w => (
          <Link
            key={w.id}
            to={`/workouts/${w.id}`}
            className="flex items-center gap-3 rounded-2xl bg-white dark:bg-zinc-900 px-4 py-3.5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <Dumbbell size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-900 dark:text-zinc-100">{w.title}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                {formatDate(w.date)} · {t('workouts.setCount', { count: w.setCount })}
                {w.durationMinutes != null && ` · ${w.durationMinutes} min`}
                {w.volumeKg > 0 && ` · ${Math.round(w.volumeKg).toLocaleString(dateLocale())} kg`}
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-gray-300 dark:text-zinc-700" />
          </Link>
        ))}
      </div>
    </div>
  )
}
