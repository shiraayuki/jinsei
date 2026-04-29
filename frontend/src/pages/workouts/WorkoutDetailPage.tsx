import { useParams, useNavigate, Link } from 'react-router-dom'
import { Pencil, Trash2, Clock, Dumbbell } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useWorkout, useDeleteWorkout } from '../../features/workouts/hooks'

export function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: workout, isLoading } = useWorkout(id!)
  const deleteMut = useDeleteWorkout()

  async function handleDelete() {
    if (!id || !confirm('Workout löschen?')) return
    await deleteMut.mutateAsync(id)
    navigate('/workouts')
  }

  const date = workout
    ? new Date(workout.date + 'T00:00:00').toLocaleDateString('de-DE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''

  return (
    <div>
      <PageHeader
        title={workout?.name ?? 'Workout'}
        back
        action={
          id && (
            <Link to={`/workouts/${id}/edit`} className="text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:text-zinc-200">
              <Pencil size={18} />
            </Link>
          )
        }
      />

      {isLoading && <p className="p-4 text-gray-400 dark:text-zinc-500 text-sm">Laden…</p>}

      {workout && (
        <div className="space-y-4 p-4">
          {/* Meta */}
          <div className="flex gap-4 text-sm text-gray-500 dark:text-zinc-400">
            <span>{date}</span>
            {workout.durationMinutes && (
              <span className="flex items-center gap-1">
                <Clock size={14} /> {workout.durationMinutes} min
              </span>
            )}
          </div>

          {workout.notes && (
            <p className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-sm text-gray-600 dark:text-zinc-300">
              {workout.notes}
            </p>
          )}

          {/* Exercises */}
          <div className="space-y-3">
            {workout.exercises.map(we => (
              <Card key={we.id} className="p-4">
                <div className="mb-3 flex items-start gap-2">
                  <Dumbbell size={16} className="mt-0.5 shrink-0 text-indigo-400" />
                  <div>
                    <p className="font-medium text-gray-800 dark:text-zinc-100">{we.exerciseName}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      {we.muscles.filter(m => m.isPrimary).map(m => m.name).join(', ')}
                    </p>
                  </div>
                </div>

                {/* Sets table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 dark:text-zinc-500">
                        <th className="pb-1 text-left">Satz</th>
                        <th className="pb-1 text-right">kg</th>
                        <th className="pb-1 text-right">Wdh.</th>
                        {we.sets.some(s => s.rpe) && <th className="pb-1 text-right">RPE</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {we.sets.map(s => (
                        <tr key={s.id} className="border-t border-gray-200 dark:border-zinc-800">
                          <td className="py-1.5 text-gray-500 dark:text-zinc-400">{s.setNumber}</td>
                          <td className="py-1.5 text-right font-mono text-gray-700 dark:text-zinc-200">
                            {s.weightKg ?? '—'}
                          </td>
                          <td className="py-1.5 text-right font-mono text-gray-700 dark:text-zinc-200">
                            {s.reps ?? '—'}
                          </td>
                          {we.sets.some(set => set.rpe) && (
                            <td className="py-1.5 text-right text-gray-500 dark:text-zinc-400">{s.rpe ?? ''}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>

          <Button
            variant="danger"
            className="w-full"
            onClick={handleDelete}
            loading={deleteMut.isPending}
          >
            <Trash2 size={16} />
            Workout löschen
          </Button>
        </div>
      )}
    </div>
  )
}
