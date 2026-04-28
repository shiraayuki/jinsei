import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, Square, Plus, Trash2, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useExercises, useCreateWorkout } from '../../features/workouts/hooks'

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

  const existing = loadSession()
  const [startedAt] = useState<number>(existing?.startedAt ?? Date.now())
  const [totalPausedMs, setTotalPausedMs] = useState(existing?.totalPausedMs ?? 0)
  const [pausedAt, setPausedAt] = useState<number | null>(existing?.pausedAt ?? null)
  const [rows, setRows] = useState<SessionExercise[]>(existing?.exercises ?? [])
  const [elapsed, setElapsed] = useState(0)
  const [showExPicker, setShowExPicker] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)

  const isPaused = pausedAt !== null
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const calcElapsed = useCallback(() => {
    if (isPaused && pausedAt !== null) return pausedAt - startedAt - totalPausedMs
    return Date.now() - startedAt - totalPausedMs
  }, [isPaused, pausedAt, startedAt, totalPausedMs])

  useEffect(() => {
    setElapsed(calcElapsed())
    if (!isPaused) {
      intervalRef.current = setInterval(() => setElapsed(calcElapsed()), 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPaused, calcElapsed])

  useEffect(() => {
    saveSession({ startedAt, totalPausedMs, pausedAt, exercises: rows })
  }, [startedAt, totalPausedMs, pausedAt, rows])

  // Init: if no existing session, mark as started (nothing extra needed)
  useEffect(() => {
    if (!existing) saveSession({ startedAt, totalPausedMs: 0, pausedAt: null, exercises: [] })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function togglePause() {
    if (isPaused) {
      const now = Date.now()
      setTotalPausedMs(prev => prev + (now - pausedAt!))
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
                {
                  reps: row.sets.at(-1)?.reps ?? '',
                  weightKg: row.sets.at(-1)?.weightKg ?? '',
                  done: false,
                },
              ],
            }
          : row,
      ),
    )
  }

  function removeSet(exIdx: number, setIdx: number) {
    setRows(prev =>
      prev.map((row, i) =>
        i === exIdx
          ? { ...row, sets: row.sets.filter((_, si) => si !== setIdx) }
          : row,
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
      exercises: rows.map((row, order) => ({
        exerciseId: row.exerciseId,
        order,
        sets: row.sets
          .filter(s => s.reps || s.weightKg)
          .map((s, idx) => ({
            setNumber: idx + 1,
            reps: s.reps ? Number(s.reps) : undefined,
            weightKg: s.weightKg ? Number(s.weightKg) : undefined,
          })),
      })).filter(ex => ex.sets.length > 0),
    })

    clearSession()
    navigate('/workouts')
  }

  function cancelSession() {
    clearSession()
    navigate('/workouts')
  }

  const filteredEx = exercises?.filter(e =>
    e.name.toLowerCase().includes(exSearch.toLowerCase()),
  )

  const doneSets = rows.flatMap(r => r.sets).filter(s => s.done).length
  const totalSets = rows.flatMap(r => r.sets).length

  return (
    <div className="pb-6">
      <PageHeader
        title="Workout läuft"
        action={
          <button
            onClick={cancelSession}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300"
          >
            <Square size={16} />
            Abbrechen
          </button>
        }
      />

      {/* Timer */}
      <div className="flex flex-col items-center gap-3 py-6">
        <span
          className={`font-mono text-5xl font-bold tabular-nums transition-colors ${
            isPaused ? 'text-zinc-500' : 'text-zinc-100'
          }`}
        >
          {formatTime(elapsed)}
        </span>

        <div className="flex gap-3">
          <button
            onClick={togglePause}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
              isPaused
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
            {isPaused ? 'Fortsetzen' : 'Pause'}
          </button>
        </div>

        {totalSets > 0 && (
          <p className="text-xs text-zinc-600">
            {doneSets} / {totalSets} Sets abgehakt
          </p>
        )}
      </div>

      <div className="space-y-3 px-4">
        {/* Exercise rows */}
        {rows.map((row, exIdx) => (
          <Card key={exIdx} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium text-zinc-100">{row.exerciseName}</p>
              <button onClick={() => removeExercise(exIdx)} className="text-zinc-600 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[2rem_1fr_1fr_2rem_2rem] gap-2 text-xs text-zinc-500">
                <span className="text-center">Set</span>
                <span className="text-center">kg</span>
                <span className="text-center">Wdh.</span>
                <span />
                <span />
              </div>

              {row.sets.map((s, sIdx) => (
                <div key={sIdx} className={`grid grid-cols-[2rem_1fr_1fr_2rem_2rem] items-center gap-2 rounded-lg transition-colors ${s.done ? 'opacity-60' : ''}`}>
                  <span className="text-center text-sm text-zinc-500">{sIdx + 1}</span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="–"
                    value={s.weightKg}
                    onChange={e => updateSet(exIdx, sIdx, 'weightKg', e.target.value)}
                    disabled={s.done}
                    className="h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-2 text-center text-zinc-100 outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <input
                    type="number"
                    placeholder="–"
                    value={s.reps}
                    onChange={e => updateSet(exIdx, sIdx, 'reps', e.target.value)}
                    disabled={s.done}
                    className="h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-2 text-center text-zinc-100 outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => toggleSetDone(exIdx, sIdx)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      s.done
                        ? 'bg-green-600 text-white'
                        : 'border border-zinc-700 text-zinc-600 hover:border-green-500 hover:text-green-400'
                    }`}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => removeSet(exIdx, sIdx)}
                    className="text-zinc-600 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => addSet(exIdx)}
              className="mt-3 w-full rounded-lg border border-dashed border-zinc-700 py-1.5 text-sm text-zinc-500 hover:border-indigo-500 hover:text-indigo-400"
            >
              + Set
            </button>
          </Card>
        ))}

        {/* Add exercise */}
        <Button variant="secondary" className="w-full" onClick={() => setShowExPicker(v => !v)}>
          <Plus size={18} />
          Übung hinzufügen
        </Button>

        {showExPicker && (
          <Card className="p-3">
            <input
              autoFocus
              value={exSearch}
              onChange={e => setExSearch(e.target.value)}
              placeholder="Übung suchen…"
              className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500"
            />
            <div className="mt-2 max-h-52 overflow-y-auto space-y-1">
              {filteredEx?.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => addExercise(ex.id, ex.name)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-800"
                >
                  <span className="text-zinc-100">{ex.name}</span>
                  {ex.muscles.some(m => m.isPrimary) && (
                    <span className="ml-2 text-xs text-zinc-500">
                      {ex.muscles.filter(m => m.isPrimary).map(m => m.name).join(', ')}
                    </span>
                  )}
                </button>
              ))}
              {filteredEx?.length === 0 && (
                <p className="py-4 text-center text-sm text-zinc-500">Keine Übungen gefunden.</p>
              )}
            </div>
            <button onClick={() => setShowExPicker(false)} className="mt-2 w-full text-center text-sm text-zinc-500">
              Schließen
            </button>
          </Card>
        )}

        {/* Finish */}
        {!showFinishConfirm ? (
          <Button
            size="lg"
            className="w-full bg-green-600 hover:bg-green-500"
            onClick={() => setShowFinishConfirm(true)}
            disabled={rows.length === 0}
          >
            Workout beenden
          </Button>
        ) : (
          <Card className="space-y-3 p-4">
            <p className="text-center text-sm text-zinc-300">
              Workout speichern? Dauer: <strong>{formatTime(elapsed)}</strong>
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowFinishConfirm(false)}>
                Zurück
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-500"
                loading={createWorkout.isPending}
                onClick={finishWorkout}
              >
                Speichern
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
