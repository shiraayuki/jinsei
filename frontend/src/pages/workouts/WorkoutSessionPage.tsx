import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, Plus, Trash2, Check, X, Dumbbell, Search, BookOpen } from 'lucide-react'
import { useExercises, useCreateWorkout, useCreateExercise, useRoutines } from '../../features/workouts/hooks'
import { exercisesApi } from '../../features/workouts/api'
import type { LastPerformance } from '../../features/workouts/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

const STORAGE_KEY = 'jinsei:workout-session'

interface SessionSet {
  reps: string
  weightKg: string
  done: boolean
}

interface SessionExercise {
  exerciseId: string
  exerciseName: string
  sets: SessionSet[]
}

interface PersistedSession {
  startedAt: number
  totalPausedMs: number
  pausedAt: number | null
  exercises: SessionExercise[]
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedSession) : null
  } catch {
    return null
  }
}

function saveSession(s: PersistedSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function WorkoutSessionPage() {
  const navigate = useNavigate()
  const { data: exercises } = useExercises()
  const { data: routines } = useRoutines()
  const createWorkout = useCreateWorkout()
  const createExercise = useCreateExercise()

  const [startedAt] = useState<number>(() => loadSession()?.startedAt ?? Date.now())
  const [totalPausedMs, setTotalPausedMs] = useState(() => loadSession()?.totalPausedMs ?? 0)
  const [pausedAt, setPausedAt] = useState<number | null>(() => loadSession()?.pausedAt ?? null)
  const [rows, setRows] = useState<SessionExercise[]>(() => loadSession()?.exercises ?? [])
  const [elapsed, setElapsed] = useState(() => {
    const s = loadSession()
    if (!s) return 0
    return s.pausedAt != null
      ? s.pausedAt - s.startedAt - s.totalPausedMs
      : Date.now() - s.startedAt - s.totalPausedMs
  })

  // Last performance cache: exerciseId → sets
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance>>({})

  const [showExPicker, setShowExPicker] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [showCreateEx, setShowCreateEx] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [showRoutinePicker, setShowRoutinePicker] = useState(false)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const isPaused = pausedAt !== null
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const calcElapsed = useCallback(() => {
    if (isPaused && pausedAt !== null) return pausedAt - startedAt - totalPausedMs
    return Date.now() - startedAt - totalPausedMs
  }, [isPaused, pausedAt, startedAt, totalPausedMs])

  useEffect(() => {
    if (!isPaused) {
      intervalRef.current = setInterval(() => setElapsed(calcElapsed()), 1000)
      return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }
  }, [isPaused, calcElapsed])

  useEffect(() => {
    saveSession({ startedAt, totalPausedMs, pausedAt, exercises: rows })
  }, [startedAt, totalPausedMs, pausedAt, rows])

  async function fetchLastPerf(exerciseId: string) {
    if (lastPerf[exerciseId]) return
    try {
      const perf = await exercisesApi.lastPerformance(exerciseId)
      if (perf) setLastPerf(prev => ({ ...prev, [exerciseId]: perf }))
    } catch {
      // ignore
    }
  }

  function togglePause() {
    if (isPaused) {
      setTotalPausedMs(prev => prev + (Date.now() - pausedAt!))
      setPausedAt(null)
    } else {
      setPausedAt(Date.now())
    }
  }

  function openPicker() {
    setShowExPicker(true)
    setShowSearch(false)
    setExSearch('')
    setShowCreateEx(false)
    setNewExName('')
  }

  function closePicker() {
    setShowExPicker(false)
    setShowSearch(false)
    setExSearch('')
    setShowCreateEx(false)
    setNewExName('')
  }

  function addExercise(id: string, name: string, setCount = 1) {
    setRows(prev => [
      ...prev,
      {
        exerciseId: id,
        exerciseName: name,
        sets: Array.from({ length: setCount }, () => ({ reps: '', weightKg: '', done: false })),
      },
    ])
    fetchLastPerf(id)
    closePicker()
    setShowRoutinePicker(false)
  }

  function loadRoutine(routineId: string) {
    const routine = routines?.find(r => r.id === routineId)
    if (!routine) return
    routine.exercises.forEach(re => {
      addExercise(re.exerciseId, re.exerciseName, re.setCount)
    })
    setShowRoutinePicker(false)
  }

  async function handleCreateExercise() {
    if (!newExName.trim()) return
    const ex = await createExercise.mutateAsync({ name: newExName.trim(), muscles: [] })
    addExercise(ex.id, ex.name)
  }

  function removeExercise(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  function addSet(exIdx: number) {
    setRows(prev =>
      prev.map((row, i) =>
        i === exIdx
          ? {
              ...row,
              sets: [
                ...row.sets,
                { reps: row.sets.at(-1)?.reps ?? '', weightKg: row.sets.at(-1)?.weightKg ?? '', done: false },
              ],
            }
          : row,
      ),
    )
  }

  function removeSet(exIdx: number, setIdx: number) {
    setRows(prev =>
      prev.map((row, i) =>
        i === exIdx ? { ...row, sets: row.sets.filter((_, si) => si !== setIdx) } : row,
      ),
    )
  }

  function updateSet(exIdx: number, setIdx: number, field: 'reps' | 'weightKg', val: string) {
    setRows(prev =>
      prev.map((row, i) =>
        i === exIdx
          ? { ...row, sets: row.sets.map((s, si) => (si === setIdx ? { ...s, [field]: val } : s)) }
          : row,
      ),
    )
  }

  function toggleSetDone(exIdx: number, setIdx: number) {
    setRows(prev =>
      prev.map((row, i) =>
        i === exIdx
          ? { ...row, sets: row.sets.map((s, si) => (si === setIdx ? { ...s, done: !s.done } : s)) }
          : row,
      ),
    )
  }

  async function finishWorkout() {
    const durationMinutes = Math.max(1, Math.round(elapsed / 60000))
    const today = new Date().toISOString().slice(0, 10)
    await createWorkout.mutateAsync({
      date: today,
      durationMinutes,
      exercises: rows
        .map((row, order) => ({
          exerciseId: row.exerciseId,
          order,
          sets: row.sets
            .filter(s => s.reps || s.weightKg)
            .map((s, idx) => ({
              setNumber: idx + 1,
              reps: s.reps ? Number(s.reps) : undefined,
              weightKg: s.weightKg ? Number(s.weightKg) : undefined,
            })),
        }))
        .filter(ex => ex.sets.length > 0),
    })
    clearSession()
    navigate('/workouts')
  }

  const doneSets = rows.flatMap(r => r.sets).filter(s => s.done).length
  const totalSets = rows.flatMap(r => r.sets).length
  const filteredEx = exercises?.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase()))

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-zinc-950 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Workout Session</p>
        <button
          onClick={() => setShowCancelConfirm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <X size={15} />
          Abbrechen
        </button>
      </div>

      {/* Timer */}
      <div className="flex flex-col items-center pt-6 pb-8">
        <div className="relative flex items-center justify-center">
          {!isPaused && (
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" style={{ animationDuration: '3s' }} />
          )}
          <div className={`relative flex h-40 w-40 items-center justify-center rounded-full border-2 transition-colors ${
            isPaused ? 'border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900' : 'border-indigo-500/40 bg-indigo-500/5'
          }`}>
            <span className={`font-mono text-4xl font-bold tabular-nums transition-colors ${
              isPaused ? 'text-gray-400 dark:text-zinc-500' : 'text-white'
            }`}>
              {formatTime(elapsed)}
            </span>
          </div>
        </div>

        <button
          onClick={togglePause}
          className={`mt-6 flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-all ${
            isPaused
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 hover:bg-indigo-500'
              : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
          }`}
        >
          {isPaused ? <Play size={16} fill="white" /> : <Pause size={16} />}
          {isPaused ? 'Fortsetzen' : 'Pause'}
        </button>

        {totalSets > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 w-32 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${(doneSets / totalSets) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 dark:text-zinc-500">{doneSets}/{totalSets}</span>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4">
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-zinc-800">
              <Dumbbell size={24} className="text-gray-400 dark:text-zinc-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-gray-400 dark:text-zinc-500">Füge deine erste Übung hinzu</p>
          </div>
        )}

        {rows.map((row, exIdx) => {
          const perf = lastPerf[row.exerciseId]
          return (
            <div key={exIdx} className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-zinc-100">{row.exerciseName}</p>
                  {perf && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                      Letztes Mal ({perf.date}): {perf.sets.map(s => `${s.weightKg ?? '—'}kg × ${s.reps ?? '—'}`).join(' · ')}
                    </p>
                  )}
                </div>
                <button onClick={() => removeExercise(exIdx)} className="text-gray-400 dark:text-zinc-600 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem_2rem] gap-2 px-1 text-xs font-medium text-gray-400 dark:text-zinc-600">
                  <span className="text-center">Set</span>
                  <span className="text-center">kg</span>
                  <span className="text-center">Wdh.</span>
                  <span />
                  <span />
                </div>

                {row.sets.map((s, sIdx) => {
                  const hint = perf?.sets[sIdx]
                  return (
                    <div
                      key={sIdx}
                      className={`grid grid-cols-[2.5rem_1fr_1fr_2.5rem_2rem] items-center gap-2 transition-opacity ${s.done ? 'opacity-50' : ''}`}
                    >
                      <span className="text-center text-sm font-medium text-gray-400 dark:text-zinc-500">{sIdx + 1}</span>
                      <input
                        type="number"
                        step="0.5"
                        placeholder={hint?.weightKg != null ? String(hint.weightKg) : '—'}
                        value={s.weightKg}
                        onChange={e => updateSet(exIdx, sIdx, 'weightKg', e.target.value)}
                        disabled={s.done}
                        className="h-10 rounded-xl border border-gray-300/80 dark:border-zinc-700/80 bg-gray-100/80 dark:bg-zinc-800/80 px-2 text-center text-sm text-gray-800 dark:text-zinc-100 outline-none focus:border-indigo-500 focus:bg-gray-100 dark:focus:bg-zinc-800 disabled:cursor-not-allowed placeholder:text-indigo-400/60 dark:placeholder:text-indigo-500/50"
                      />
                      <input
                        type="number"
                        placeholder={hint?.reps != null ? String(hint.reps) : '—'}
                        value={s.reps}
                        onChange={e => updateSet(exIdx, sIdx, 'reps', e.target.value)}
                        disabled={s.done}
                        className="h-10 rounded-xl border border-gray-300/80 dark:border-zinc-700/80 bg-gray-100/80 dark:bg-zinc-800/80 px-2 text-center text-sm text-gray-800 dark:text-zinc-100 outline-none focus:border-indigo-500 focus:bg-gray-100 dark:focus:bg-zinc-800 disabled:cursor-not-allowed placeholder:text-indigo-400/60 dark:placeholder:text-indigo-500/50"
                      />
                      <button
                        onClick={() => toggleSetDone(exIdx, sIdx)}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                          s.done
                            ? 'bg-green-500 text-white shadow-md shadow-green-900/40'
                            : 'border border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-600 hover:border-green-500 hover:text-green-400'
                        }`}
                      >
                        <Check size={15} strokeWidth={2.5} />
                      </button>
                      <button onClick={() => removeSet(exIdx, sIdx)} className="text-zinc-700 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => addSet(exIdx)}
                className="mt-3 w-full rounded-xl border border-dashed border-gray-300/60 dark:border-zinc-700/60 py-2 text-sm text-gray-400 dark:text-zinc-600 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors"
              >
                + Set hinzufügen
              </button>
            </div>
          )
        })}

        <div className="grid grid-cols-2 gap-2">
          {routines && routines.length > 0 && (
            <button
              onClick={() => setShowRoutinePicker(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 py-3.5 text-sm font-medium text-gray-500 dark:text-zinc-400 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors"
            >
              <BookOpen size={16} />
              Routine laden
            </button>
          )}
          <button
            onClick={openPicker}
            className={`flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 py-3.5 text-sm font-medium text-gray-500 dark:text-zinc-400 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors ${routines && routines.length > 0 ? '' : 'col-span-2'}`}
          >
            <Plus size={18} />
            Übung hinzufügen
          </button>
        </div>

        <button
          onClick={() => setShowFinishConfirm(true)}
          disabled={rows.length === 0}
          className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-4 text-sm font-bold text-white shadow-lg shadow-green-900/30 hover:opacity-90 disabled:opacity-30 disabled:shadow-none transition-all"
        >
          Workout beenden
        </button>
      </div>

      {/* Routine picker — portal */}
      {showRoutinePicker && createPortal(
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setShowRoutinePicker(false)}
        >
          <div
            className="flex flex-col rounded-t-2xl bg-white dark:bg-zinc-900 mb-16"
            style={{ maxHeight: 'calc(70vh - 4rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
              <h3 className="font-semibold text-gray-800 dark:text-zinc-100">Routine laden</h3>
              <button onClick={() => setShowRoutinePicker(false)} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {routines?.map(r => (
                <button
                  key={r.id}
                  onClick={() => loadRoutine(r.id)}
                  className="w-full rounded-xl px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <p className="font-medium text-gray-800 dark:text-zinc-100">{r.name}</p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-zinc-500">
                    {r.exercises.map(e => `${e.exerciseName} ×${e.setCount}`).join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Exercise picker — portal */}
      {showExPicker && createPortal(
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          onClick={closePicker}
        >
          <div
            className="flex flex-col rounded-t-2xl bg-white dark:bg-zinc-900 mb-16"
            style={{ maxHeight: 'calc(85vh - 4rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
              <h3 className="font-semibold text-gray-800 dark:text-zinc-100">Übung hinzufügen</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setShowSearch(s => !s); setShowCreateEx(false) }}
                  className={`rounded-lg p-2 transition-colors ${
                    showSearch
                      ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'text-gray-400 hover:text-indigo-500'
                  }`}
                >
                  <Search size={18} />
                </button>
                <button onClick={closePicker} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
                  <X size={18} />
                </button>
              </div>
            </div>

            {showSearch && !showCreateEx && (
              <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
                <Input placeholder="Suchen…" value={exSearch} onChange={e => setExSearch(e.target.value)} autoFocus />
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-3 space-y-1">
              {!showCreateEx ? (
                <>
                  {filteredEx?.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex.id, ex.name)}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className="font-medium text-gray-800 dark:text-zinc-100">{ex.name}</span>
                      {ex.muscles.some(m => m.isPrimary) && (
                        <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">
                          {ex.muscles.filter(m => m.isPrimary).map(m => m.name).join(', ')}
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredEx?.length === 0 && (
                    <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-600">Nichts gefunden.</p>
                  )}
                  <button
                    onClick={() => setShowCreateEx(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 py-2.5 text-sm text-gray-400 dark:text-zinc-500 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors mt-2"
                  >
                    <Plus size={15} />
                    Neue Übung erstellen
                  </button>
                </>
              ) : (
                <div className="space-y-3 p-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-zinc-300">Neue Übung</p>
                  <input
                    autoFocus
                    value={newExName}
                    onChange={e => setNewExName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateExercise()}
                    placeholder="Name der Übung"
                    className="h-11 w-full rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 px-3 text-sm text-gray-800 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateEx(false)}
                      className="flex-1 rounded-xl border border-gray-300 dark:border-zinc-700 py-2.5 text-sm text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Zurück
                    </button>
                    <button
                      onClick={handleCreateExercise}
                      disabled={!newExName.trim() || createExercise.isPending}
                      className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                    >
                      {createExercise.isPending ? 'Erstellen…' : 'Erstellen & hinzufügen'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Finish confirm */}
      {showFinishConfirm && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xl">
            <p className="font-semibold text-gray-800 dark:text-zinc-100">Workout speichern?</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-zinc-500">
              Dauer: <span className="font-semibold text-gray-700 dark:text-zinc-300">{formatTime(elapsed)}</span>
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowFinishConfirm(false)}>
                Zurück
              </Button>
              <Button className="flex-1 !bg-green-600 hover:!bg-green-500" loading={createWorkout.isPending} onClick={finishWorkout}>
                Speichern
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Cancel confirm */}
      {showCancelConfirm && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xl">
            <p className="font-semibold text-gray-800 dark:text-zinc-100">Session wirklich abbrechen?</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-zinc-500">Alle Daten gehen verloren.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowCancelConfirm(false)}>
                Weiter trainieren
              </Button>
              <Button className="flex-1 !bg-red-500 hover:!bg-red-600" onClick={() => { clearSession(); navigate('/workouts') }}>
                Abbrechen
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
