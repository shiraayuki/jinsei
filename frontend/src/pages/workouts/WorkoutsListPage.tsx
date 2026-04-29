import { Link } from 'react-router-dom'
import { Plus, Dumbbell, Play, ChevronRight, BookOpen, Library } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useWorkouts } from '../../features/workouts/hooks'
import type { WorkoutSummary } from '../../features/workouts/api'

const SESSION_KEY = 'jinsei:workout-session'

function WorkoutRow({ w }: { w: WorkoutSummary }) {
  const date = new Date(w.date + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  return (
    <Link to={`/workouts/${w.id}`} className="block">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 transition-colors hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-gray-100/60 dark:hover:bg-zinc-800/60">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
          <Dumbbell size={20} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-800 dark:text-zinc-100">{w.name ?? 'Workout'}</p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-zinc-500">
            {date}
            <span className="mx-1.5 text-zinc-700">·</span>
            {w.exerciseCount} Übung{w.exerciseCount !== 1 ? 'en' : ''}
            <span className="mx-1.5 text-zinc-700">·</span>
            {w.setCount} Sets
            {w.durationMinutes ? (
              <>
                <span className="mx-1.5 text-zinc-700">·</span>
                {w.durationMinutes} min
              </>
            ) : null}
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-gray-400 dark:text-zinc-600" />
      </div>
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
          <Link to="/workouts/new" className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:bg-zinc-700">
            <Plus size={14} />
            Loggen
          </Link>
        }
      />

      <div className="space-y-3 px-4 pt-1 pb-4">
        {/* Start session CTA */}
        <Link
          to="/workouts/session"
          className="relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 px-5 py-4 shadow-lg shadow-indigo-900/30 transition-opacity hover:opacity-90"
        >
          <div>
            <p className="font-bold text-white">
              {hasActiveSession ? 'Session fortsetzen' : 'Workout starten'}
            </p>
            <p className="mt-0.5 text-xs text-indigo-200">
              {hasActiveSession ? 'Dein Training läuft noch' : 'Timer starten, Übungen tracken'}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <Play size={22} className="text-white" fill="white" />
          </div>
          {/* Decorative blob */}
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="absolute -left-2 -bottom-6 h-16 w-16 rounded-full bg-indigo-500/20" />
        </Link>

        {/* Quick nav: Library + Routines */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/exercises"
            className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors"
          >
            <Library size={16} className="text-indigo-400 shrink-0" />
            Bibliothek
          </Link>
          <Link
            to="/routines"
            className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors"
          >
            <BookOpen size={16} className="text-indigo-400 shrink-0" />
            Routinen
          </Link>
        </div>

        {/* Workout list */}
        {isLoading && (
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100/50 dark:bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && workouts?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-zinc-800">
              <Dumbbell size={28} className="text-gray-400 dark:text-zinc-600" />
            </div>
            <p className="mt-2 font-medium text-gray-500 dark:text-zinc-400">Noch keine Workouts</p>
            <p className="text-sm text-gray-400 dark:text-zinc-600">Starte deine erste Session oben.</p>
          </div>
        )}

        {workouts && workouts.length > 0 && (
          <div className="pt-1">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-zinc-600">Verlauf</p>
            <div className="flex flex-col gap-4">
              {workouts.map(w => <WorkoutRow key={w.id} w={w} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
