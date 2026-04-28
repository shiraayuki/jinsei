import { Link } from 'react-router-dom'
import { Plus, Dumbbell, Play } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { useWorkouts } from '../../features/workouts/hooks'
import type { WorkoutSummary } from '../../features/workouts/api'

const SESSION_KEY = 'jinsei:workout-session'

function WorkoutRow({ w }: { w: WorkoutSummary }) {
  const date = new Date(w.date + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  return (
    <Link to={`/workouts/${w.id}`}>
      <Card className="flex items-center gap-3 px-4 py-3 hover:border-zinc-700 transition-colors">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-900/30 text-indigo-400">
          <Dumbbell size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-100">{w.name ?? 'Workout'}</p>
          <p className="text-xs text-zinc-500">
            {date} · {w.exerciseCount} Übung{w.exerciseCount !== 1 ? 'en' : ''} · {w.setCount} Sets
            {w.durationMinutes ? ` · ${w.durationMinutes} min` : ''}
          </p>
        </div>
      </Card>
    </Link>
  )
}

export function WorkoutsListPage() {
  const { data: workouts, isLoading } = useWorkouts()
  const hasActiveSession = !!localStorage.getItem(SESSION_KEY)

  return (
    <div>
      <PageHeader
        title="Workouts"
        action={
          <Link to="/workouts/new" className="text-indigo-400 hover:text-indigo-300">
            <Plus size={24} />
          </Link>
        }
      />

      <div className="px-4 pt-2 pb-1">
        <Link
          to="/workouts/session"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Play size={16} />
          {hasActiveSession ? 'Session fortsetzen' : 'Workout starten'}
        </Link>
      </div>

      <div className="space-y-2 p-4">
        {isLoading && <p className="py-8 text-center text-sm text-zinc-500">Laden…</p>}

        {!isLoading && workouts?.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-zinc-400">Noch keine Workouts.</p>
            <Link
              to="/workouts/new"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Erstes Workout loggen
            </Link>
          </div>
        )}

        {workouts?.map(w => <WorkoutRow key={w.id} w={w} />)}
      </div>

      <div className="px-4 pb-2">
        <Link to="/exercises" className="text-sm text-zinc-500 hover:text-zinc-300 underline">
          Übungs-Bibliothek verwalten →
        </Link>
      </div>
    </div>
  )
}
