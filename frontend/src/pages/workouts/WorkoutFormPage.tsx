import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, Search, X } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import {
  useExercises,
  useCreateWorkout,
  useUpdateWorkout,
  useWorkout,
} from '../../features/workouts/hooks'
import type { UpsertWorkoutPayload } from '../../features/workouts/api'

interface SetRow {
  setNumber: number
  reps: string
  weightKg: string
}

interface ExerciseRow {
  exerciseId: string
  exerciseName: string
  sets: SetRow[]
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function WorkoutFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const { data: exercises } = useExercises()
  const { data: existing } = useWorkout(id ?? '')
  const createMut = useCreateWorkout()
  const updateMut = useUpdateWorkout()

  const [date, setDate] = useState(todayIso())
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('')
  const [rows, setRows] = useState<ExerciseRow[]>([])

  const [showPicker, setShowPicker] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [confirmClosePicker, setConfirmClosePicker] = useState(false)

  useEffect(() => {
    if (existing) {
      setDate(existing.date)
      setName(existing.name ?? '')
      setNotes(existing.notes ?? '')
      setDuration(String(existing.durationMinutes ?? ''))
      setRows(
        existing.exercises.map(we => ({
          exerciseId: we.exerciseId,
          exerciseName: we.exerciseName,
          sets: we.sets.map(s => ({
            setNumber: s.setNumber,
            reps: String(s.reps ?? ''),
            weightKg: String(s.weightKg ?? ''),
          })),
        })),
      )
    }
  }, [existing])

  function openPicker() {
    setShowPicker(true)
    setShowSearch(false)
    setExSearch('')
    setConfirmClosePicker(false)
  }

  function tryClosePicker() {
    setConfirmClosePicker(true)
  }

  function closePicker() {
    setShowPicker(false)
    setShowSearch(false)
    setExSearch('')
    setConfirmClosePicker(false)
  }

  function addExercise(exId: string, exName: string) {
    setRows(prev => [
      ...prev,
      { exerciseId: exId, exerciseName: exName, sets: [{ setNumber: 1, reps: '', weightKg: '' }] },
    ])
    closePicker()
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
                  setNumber: row.sets.length + 1,
                  reps: row.sets.at(-1)?.reps ?? '',
                  weightKg: row.sets.at(-1)?.weightKg ?? '',
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
          ? {
              ...row,
              sets: row.sets
                .filter((_, si) => si !== setIdx)
                .map((s, si) => ({ ...s, setNumber: si + 1 })),
            }
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

  async function save() {
    const payload: UpsertWorkoutPayload = {
      date,
      name: name || undefined,
      notes: notes || undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      exercises: rows.map((row, order) => ({
        exerciseId: row.exerciseId,
        order,
        sets: row.sets.map(s => ({
          setNumber: s.setNumber,
          reps: s.reps ? Number(s.reps) : undefined,
          weightKg: s.weightKg ? Number(s.weightKg) : undefined,
        })),
      })),
    }

    if (isEdit && id) {
      await updateMut.mutateAsync({ id, data: payload })
    } else {
      await createMut.mutateAsync(payload)
    }
    navigate('/workouts')
  }

  const filteredEx = exercises?.filter(e =>
    e.name.toLowerCase().includes(exSearch.toLowerCase()),
  )

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div>
      <PageHeader title={isEdit ? 'Workout bearbeiten' : 'Workout loggen'} back />

      <div className="space-y-4 p-4">
        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Datum" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input
            label="Dauer (min)"
            type="number"
            placeholder="60"
            value={duration}
            onChange={e => setDuration(e.target.value)}
          />
        </div>
        <Input label="Name (optional)" placeholder="Push Day" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Notizen" placeholder="…" value={notes} onChange={e => setNotes(e.target.value)} />

        {/* Exercise rows */}
        {rows.map((row, exIdx) => (
          <Card key={exIdx} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium text-gray-800 dark:text-zinc-100">{row.exerciseName}</p>
              <button onClick={() => removeExercise(exIdx)} className="text-gray-400 dark:text-zinc-600 hover:text-red-400">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-xs text-gray-400 dark:text-zinc-500">
                <span className="text-center">Set</span>
                <span className="text-center">kg</span>
                <span className="text-center">Wdh.</span>
                <span />
              </div>

              {row.sets.map((s, sIdx) => (
                <div key={sIdx} className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2">
                  <span className="text-center text-sm text-gray-400 dark:text-zinc-500">{s.setNumber}</span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="0"
                    value={s.weightKg}
                    onChange={e => updateSet(exIdx, sIdx, 'weightKg', e.target.value)}
                    className="h-10 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 px-2 text-center text-gray-800 dark:text-zinc-100 outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    placeholder="0"
                    value={s.reps}
                    onChange={e => updateSet(exIdx, sIdx, 'reps', e.target.value)}
                    className="h-10 rounded-lg border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 px-2 text-center text-gray-800 dark:text-zinc-100 outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => removeSet(exIdx, sIdx)}
                    className="text-gray-400 dark:text-zinc-600 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => addSet(exIdx)}
              className="mt-3 w-full rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 py-1.5 text-sm text-gray-400 dark:text-zinc-500 hover:border-indigo-500 hover:text-indigo-400"
            >
              + Set
            </button>
          </Card>
        ))}

        <Button variant="secondary" className="w-full" onClick={openPicker}>
          <Plus size={18} />
          Übung hinzufügen
        </Button>

        <Button size="lg" loading={isPending} className="w-full" onClick={save} disabled={rows.length === 0}>
          {isEdit ? 'Speichern' : 'Workout speichern'}
        </Button>
      </div>

      {/* Exercise picker — portal to body */}
      {showPicker && createPortal(
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          onClick={tryClosePicker}
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
                  onClick={() => setShowSearch(s => !s)}
                  className={`rounded-lg p-2 transition-colors ${
                    showSearch
                      ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'text-gray-400 hover:text-indigo-500'
                  }`}
                >
                  <Search size={18} />
                </button>
                <button
                  onClick={tryClosePicker}
                  className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {showSearch && (
              <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
                <Input
                  placeholder="Suchen…"
                  value={exSearch}
                  onChange={e => setExSearch(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-2">
              {filteredEx?.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => addExercise(ex.id, ex.name)}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span className="font-medium text-gray-800 dark:text-zinc-100">{ex.name}</span>
                  <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">
                    {ex.muscles.filter(m => m.isPrimary).map(m => m.name).join(', ')}
                  </span>
                </button>
              ))}
              {filteredEx?.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">Keine Übungen gefunden.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm close picker — portal to body */}
      {confirmClosePicker && createPortal(
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xl">
            <p className="font-semibold text-gray-800 dark:text-zinc-100">Auswahl abbrechen?</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-zinc-500">Die Suche wird zurückgesetzt.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmClosePicker(false)}>
                Weiter suchen
              </Button>
              <Button className="flex-1 !bg-red-500 hover:!bg-red-600" onClick={closePicker}>
                Schließen
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
