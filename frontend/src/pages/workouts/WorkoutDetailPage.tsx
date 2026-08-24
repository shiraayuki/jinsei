import { useParams, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useWorkout, useDeleteWorkout } from '../../features/workouts/hooks'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import type { WorkoutSet } from '../../features/workouts/api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatSet(s: WorkoutSet) {
  if (s.durationSeconds) return `${Math.round((s.durationSeconds / 60) * 10) / 10} min`
  if (s.weightKg) return `${s.weightKg} kg × ${s.reps ?? 0}`
  if (s.distanceMeters) return `${s.distanceMeters} m`
  return `${s.reps ?? 0}`
}

export function WorkoutDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data: workout, isLoading } = useWorkout(id)
  const del = useDeleteWorkout()

  if (isLoading || !workout) {
    return (
      <div>
        <PageHeader title="" back />
        <p className="p-8 text-center text-body text-ink-mute">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={workout.title}
        back
        action={
          <button
            onClick={() => del.mutate(workout.id, { onSuccess: () => navigate('/workouts') })}
            aria-label={t('common.delete')}
            className="flex h-10 w-10 items-center justify-center text-ink-mute hover:text-bad transition-colors"
          >
            <Trash2 size={17} />
          </button>
        }
      />

      <div className="space-y-4 p-4">
        <div>
          <p className="text-body text-ink-mute">{formatDate(workout.date)}</p>
          <p className="mt-1 text-meta text-ink-mute">
            {t('workouts.setCount', { count: workout.setCount })}
            {workout.durationMinutes != null && ` · ${workout.durationMinutes} min`}
            {workout.volumeKg > 0 && ` · ${Math.round(workout.volumeKg).toLocaleString(dateLocale())} kg`}
            {` · ${t('workouts.viaSource', { source: workout.source })}`}
          </p>
        </div>

        {(workout.exercises ?? []).map((ex, i) => (
          <div key={`${ex.name}-${i}`} className="card p-4">
            <p className="font-semibold text-ink">{ex.name}</p>
            <div className="mt-2 space-y-1">
              {(ex.sets ?? []).map((s, j) => (
                <div key={j} className="flex justify-between text-body">
                  <span className="text-ink-mute">{t('workouts.set')} {j + 1}</span>
                  <span className="text-ink-soft">{formatSet(s)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
