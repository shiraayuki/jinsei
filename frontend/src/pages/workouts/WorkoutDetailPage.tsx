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
        <p className="p-8 text-center text-sm text-gray-400 dark:text-zinc-500">{t('common.loading')}</p>
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
            className="flex h-10 w-10 items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={17} />
          </button>
        }
      />

      <div className="space-y-4 p-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">{formatDate(workout.date)}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
            {t('workouts.setCount', { count: workout.setCount })}
            {workout.durationMinutes != null && ` · ${workout.durationMinutes} min`}
            {workout.volumeKg > 0 && ` · ${Math.round(workout.volumeKg).toLocaleString(dateLocale())} kg`}
            {` · ${t('workouts.viaSource', { source: workout.source })}`}
          </p>
        </div>

        {workout.exercises.map((ex, i) => (
          <div key={`${ex.name}-${i}`} className="rounded-2xl bg-white dark:bg-zinc-900 p-4">
            <p className="font-semibold text-gray-900 dark:text-zinc-100">{ex.name}</p>
            <div className="mt-2 space-y-1">
              {ex.sets.map((s, j) => (
                <div key={j} className="flex justify-between text-sm">
                  <span className="text-gray-400 dark:text-zinc-500">{t('workouts.set')} {j + 1}</span>
                  <span className="text-gray-700 dark:text-zinc-200">{formatSet(s)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
