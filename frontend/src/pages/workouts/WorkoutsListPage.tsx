import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Dumbbell, Play, ChevronRight, BookOpen, Library, BarChart2, Upload } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useWorkouts } from '../../features/workouts/hooks'
import { workoutsApi } from '../../features/workouts/api'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dateLocale } from '../../i18n'
import type { WorkoutSummary } from '../../features/workouts/api'

const SESSION_KEY = 'jinsei:workout-session'

function ImportModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()

  async function handleImport() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const workout = await workoutsApi.importText(text.trim())
      await qc.invalidateQueries({ queryKey: ['workouts'] })
      navigate(`/workouts/${workout.id}`)
    } catch {
      setError(t('workouts.importFailed'))
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-zinc-100">{t('workouts.importTitle')}</h2>
        <p className="mb-3 text-xs text-gray-400 dark:text-zinc-500">{t('workouts.importHint')}</p>
        <textarea
          className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 p-3 text-xs font-mono text-gray-700 dark:text-zinc-300 placeholder-gray-300 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          rows={12}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('workouts.importPlaceholder')}
          autoFocus
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-3 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !text.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? t('workouts.importing') : t('workouts.import')}
          </button>
        </div>
      </div>
    </div>
  )
}

function WorkoutRow({ w }: { w: WorkoutSummary }) {
  const { t } = useTranslation()
  const date = new Date(w.date + 'T00:00:00').toLocaleDateString(dateLocale(), {
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
            {t('workouts.exercises', { count: w.exerciseCount })}
            <span className="mx-1.5 text-zinc-700">·</span>
            {t('workouts.sets', { count: w.setCount })}
            {w.durationMinutes ? (
              <>
                <span className="mx-1.5 text-zinc-700">·</span>
                {t('workouts.minutes', { count: w.durationMinutes })}
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
  const [showImport, setShowImport] = useState(false)
  const { t } = useTranslation()

  return (
    <div>
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      <PageHeader
        title={t('workouts.title')}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
            >
              <Upload size={14} />
              {t('workouts.import')}
            </button>
            <Link to="/workouts/new" className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700">
              <Plus size={14} />
              {t('workouts.log')}
            </Link>
          </div>
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
              {hasActiveSession ? t('workouts.continueSession') : t('workouts.startWorkout')}
            </p>
            <p className="mt-0.5 text-xs text-indigo-200">
              {hasActiveSession ? t('workouts.sessionRunning') : t('workouts.startTimerHint')}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <Play size={22} className="text-white" fill="white" />
          </div>
          {/* Decorative blob */}
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="absolute -left-2 -bottom-6 h-16 w-16 rounded-full bg-indigo-500/20" />
        </Link>

        {/* Quick nav: Library + Routines + Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Link
            to="/exercises"
            className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors"
          >
            <Library size={16} className="text-indigo-400 shrink-0" />
            {t('workouts.library')}
          </Link>
          <Link
            to="/routines"
            className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors"
          >
            <BookOpen size={16} className="text-indigo-400 shrink-0" />
            {t('workouts.routines')}
          </Link>
          <Link
            to="/workouts/stats"
            className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors"
          >
            <BarChart2 size={16} className="text-indigo-400 shrink-0" />
            {t('workouts.statistics')}
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
            <p className="mt-2 font-medium text-gray-500 dark:text-zinc-400">{t('workouts.noWorkouts')}</p>
            <p className="text-sm text-gray-400 dark:text-zinc-600">{t('workouts.noWorkoutsHint')}</p>
          </div>
        )}

        {workouts && workouts.length > 0 && (
          <div className="pt-1">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-zinc-600">{t('common.history')}</p>
            <div className="flex flex-col gap-4">
              {workouts.map(w => <WorkoutRow key={w.id} w={w} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
