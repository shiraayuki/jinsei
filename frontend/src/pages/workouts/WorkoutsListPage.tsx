import { Link } from 'react-router-dom'
import { RefreshCw, Dumbbell, ChevronRight, AlertCircle } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useWorkouts, useSyncStatus, useSyncWorkouts } from '../../features/workouts/hooks'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import { moduleColor, moduleTint } from '../../lib/modules'

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
            className="flex items-center gap-1.5 rounded-chip bg-raised px-3 py-2.5 text-meta font-medium text-ink-soft hover:bg-line disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={15} className={sync.isPending ? 'animate-spin' : undefined} />
            {t('workouts.sync')}
          </button>
        }
      />

      <div className="space-y-3 p-4">
        {!configured && (
          <div className="flex items-start gap-2 rounded-card bg-warn/10 p-3 text-meta text-warn">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{t('workouts.syncNotConfigured')}</p>
          </div>
        )}

        {sync.isError && (
          <div className="flex items-start gap-2 rounded-card bg-bad/10 p-3 text-meta text-bad">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{(sync.error as Error).message}</p>
          </div>
        )}

        {sync.isSuccess && (
          <p className="text-meta text-ink-mute">
            {t('workouts.syncResult', { added: sync.data.added, updated: sync.data.updated })}
          </p>
        )}

        {isLoading && <p className="py-8 text-center text-body text-ink-mute">{t('common.loading')}</p>}

        {!isLoading && workouts.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Dumbbell size={28} className="text-ink-faint" />
            <p className="font-medium text-ink-mute">{t('workouts.empty')}</p>
            <p className="text-body text-ink-faint">{t('workouts.emptyHint')}</p>
          </div>
        )}

        {workouts.map(w => (
          <Link
            key={w.id}
            to={`/workouts/${w.id}`}
            className="card flex items-center gap-3 px-4 py-3.5"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control"
              style={{ background: moduleTint('train'), color: moduleColor.train }}
            >
              <Dumbbell size={17} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{w.title}</p>
              <p className="text-meta text-ink-mute tabular">
                {formatDate(w.date)} · {t('workouts.setCount', { count: w.setCount })}
                {w.durationMinutes != null && ` · ${w.durationMinutes} min`}
                {w.volumeKg > 0 && ` · ${Math.round(w.volumeKg).toLocaleString(dateLocale())} kg`}
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-ink-faint" />
          </Link>
        ))}
      </div>
    </div>
  )
}
