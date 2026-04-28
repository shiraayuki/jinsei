import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, Plus, Trash2, Check, X, Dumbbell } from 'lucide-react'
import { useExercises, useCreateWorkout, useCreateExercise } from '../../features/workouts/hooks'

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
  const [showExPicker, setShowExPicker] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [showCreateEx, setShowCreateEx] = useState(false)
  const [newExName, setNewExName] = useState('')
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

  function togglePause() {
    if (isPaused) {
      setTotalPausedMs(prev => prev + (Date.now() - pausedAt!))
      setPausedAt(null)
    } else {
      setPausedAt(Date.now())
    }
  }

  function addExercise(id: string, name: string) {
    setRows(prev => [
      ...prev,
      { exerciseId: id, exerciseName: name, sets: [{ reps: '', weightKg: '', done: false }] },
    ])
    setShowExPicker(false)
    setExSearch('')
    setShowCreateEx(false)
    setNewExName('')
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
    <div className="min-h-dvh bg-zinc-950 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-or-4 pb-2 pt-4">
        <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Workout Session</p>
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
            isPaused ? 'border-zinc-700 bg-zinc-900' : 'border-indigo-500/40 bg-indigo-500/5'
          }`}>
            <span className={`font-mono text-4xl font-bold tabular-nums transition-colors ${
              isPaused ? 'text-zinc-500' : 'text-white'
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
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {isPaused ? <Play size={16} fill="white" /> : <Pause size={16} />}
          {isPaused ? 'Fortsetzen' : 'Pause'}
        </button>

        {totalSets > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 w-32 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${(doneSets / totalSets) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500">{doneSets}/{totalSets}</span>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4">
        {/* Exercise cards */}
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
              <Dumbbell size={24} className="text-zinc-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-zinc-500">Füge deine erste Übung hinzu</p>
          </div>
        )}

        {rows.map((row, exIdx) => (
          <div key={exIdx} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-zinc-100">{row.exerciseName}</p>
              <button onClick={() => removeExercise(exIdx)} className="text-zinc-600 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem_2rem] gap-2 px-1 text-xs font-medium text-zinc-600">
                <span className="text-center">Set</span>
                <span className="text-center">kg</span>
                <span className="text-center">Wdh.</span>
                <span />
                <span />
              </div>

              {row.sets.map((s, sIdx) => (
                <div
                  key={sIdx}
                  className={`grid grid-cols-[2.5rem_1fr_1fr_2.5rem_2rem] items-center gap-2 transition-opacity ${s.done ? 'opacity-50' : ''}`}
                >
                  <span className="text-center text-sm font-medium text-zinc-500">{sIdx + 1}</span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="—"
                    value={s.weightKg}
                    onChange={e => updateSet(exIdx, sIdx, 'weightKg', e.target.value)}
                    disabled={s.done}
                    className="h-10 rounded-xl border border-zinc-700/80 bg-zinc-800/80 px-2 text-center text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:bg-zinc-800 disabled:cursor-not-allowed"
                  />
                  <input
                    type="number"
                    placeholder="—"
                    value={s.reps}
                    onChange={e => updateSet(exIdx, sIdx, 'reps', e.target.value)}
                    disabled={s.done}
                    className="h-10 rounded-xl border border-zinc-700/80 bg-zinc-800/80 px-2 text-center text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:bg-zinc-800 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={() => toggleSetDone(exIdx, sIdx)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                      s.done
                        ? 'bg-green-500 text-white shadow-md shadow-green-900/40'
                        : 'border border-zinc-700 text-zinc-600 hover:border-green-500 hover:text-green-400'
                    }`}
                  >
                    <Check size={15} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => removeSet(exIdx, sIdx)} className="text-zinc-700 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => addSet(exIdx)}
              className="mt-3 w-full rounded-xl border border-dashed border-zinc-700/60 py-2 text-sm text-zinc-600 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors"
            >
              + Set hinzufügen
            </button>
          </div>
        ))}

        {/* Add exercise */}
        <button
          onClick={() => { setShowExPicker(v => !v); setShowCreateEx(false) }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 py-3.5 text-sm font-medium text-zinc-400 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors"
        >
          <Plus size={18} />
          Übung hinzufügen
        </button>

        {showExPicker && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <input
              autoFocus
              value={exSearch}
              onChange={e => setExSearch(e.target.value)}
              placeholder="Übung suchen…"
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500"
            />

            {!showCreateEx ? (
              <>
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {filteredEx?.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex.id, ex.name)}
                      className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-800"
                    >
                      <span className="text-sm font-medium text-zinc-100">{ex.name}</span>
                      {ex.muscles.some(m => m.isPrimary) && (
                        <span className="ml-2 text-xs text-zinc-500">
                          {ex.muscles.filter(m => m.isPrimary).map(m => m.name).join(', ')}
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredEx?.length === 0 && (
                    <p className="py-3 text-center text-sm text-zinc-600">Nichts gefunden.</p>
                  )}
                </div>
                <button
                  onClick={() => setShowCreateEx(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-2.5 text-sm text-zinc-500 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors"
                >
                  <Plus size={15} />
                  Neue Übung erstellen
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-300">Neue Übung</p>
                <input
                  autoFocus
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateExercise()}
                  placeholder="Name der Übung"
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCreateEx(false)}
                    className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
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

            <button
              onClick={() => { setShowExPicker(false); setShowCreateEx(false) }}
              className="w-full text-center text-sm text-zinc-600 hover:text-zinc-400"
            >
              Schließen
            </button>
          </div>
        )}

        {/* Finish */}
        {!showFinishConfirm ? (
          <button
            onClick={() => setShowFinishConfirm(true)}
            disabled={rows.length === 0}
            className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 py-4 text-sm font-bold text-white shadow-lg shadow-green-900/30 hover:opacity-90 disabled:opacity-30 disabled:shadow-none transition-all"
          >
            Workout beenden
          </button>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <p className="text-center text-sm text-zinc-300">
              Workout speichern?
              <span className="ml-1 font-bold text-white">{formatTime(elapsed)}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={finishWorkout}
                disabled={createWorkout.isPending}
                className="flex-1 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {createWorkout.isPending ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        )}

        {/* Cancel confirm */}
        {showCancelConfirm && (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 space-y-3">
            <p className="text-center text-sm text-zinc-300">Session wirklich abbrechen?<br /><span className="text-xs text-zinc-500">Alle Daten gehen verloren.</span></p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 rounded-xl border border-zinc-700 py-3 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                Weiter trainieren
              </button>
              <button
                onClick={() => { clearSession(); navigate('/workouts') }}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-500 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
