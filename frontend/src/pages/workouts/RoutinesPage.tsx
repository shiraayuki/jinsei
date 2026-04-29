import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Pencil, X, Search, GripVertical, Play } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import {
  useRoutines,
  useCreateRoutine,
  useUpdateRoutine,
  useDeleteRoutine,
  useExercises,
  useCreateExercise,
} from '../../features/workouts/hooks'
import type { Routine } from '../../features/workouts/api'

interface RoutineExRow {
  exerciseId: string
  exerciseName: string
  setCount: number
}

type ModalMode = { type: 'create' } | { type: 'edit'; routine: Routine } | null

export function RoutinesPage() {
  const { data: routines, isLoading } = useRoutines()
  const { data: exercises } = useExercises()
  const createMut = useCreateRoutine()
  const updateMut = useUpdateRoutine()
  const deleteMut = useDeleteRoutine()
  const createExMut = useCreateExercise()

  const [modal, setModal] = useState<ModalMode>(null)
  const [name, setName] = useState('')
  const [rows, setRows] = useState<RoutineExRow[]>([])
  const [confirmClose, setConfirmClose] = useState(false)

  // Exercise picker state
  const [showExPicker, setShowExPicker] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [showCreateEx, setShowCreateEx] = useState(false)
  const [newExName, setNewExName] = useState('')

  function openCreate() {
    setName('')
    setRows([])
    setModal({ type: 'create' })
    setConfirmClose(false)
  }

  function openEdit(r: Routine) {
    setName(r.name)
    setRows(r.exercises.map(e => ({ exerciseId: e.exerciseId, exerciseName: e.exerciseName, setCount: e.setCount })))
    setModal({ type: 'edit', routine: r })
    setConfirmClose(false)
  }

  function tryClose() {
    if (showExPicker) {
      closePicker()
      return
    }
    setConfirmClose(true)
  }

  function forceClose() {
    setModal(null)
    setConfirmClose(false)
    setName('')
    setRows([])
    closePicker()
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

  function pickExercise(exId: string, exName: string) {
    if (rows.some(r => r.exerciseId === exId)) return
    setRows(prev => [...prev, { exerciseId: exId, exerciseName: exName, setCount: 3 }])
    closePicker()
  }

  async function handleCreateEx() {
    if (!newExName.trim()) return
    const ex = await createExMut.mutateAsync({ name: newExName.trim(), muscles: [] })
    pickExercise(ex.id, ex.name)
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  function updateSetCount(idx: number, val: string) {
    const n = Math.max(1, parseInt(val) || 1)
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, setCount: n } : r))
  }

  async function save() {
    if (!name.trim() || rows.length === 0) return
    const payload = {
      name: name.trim(),
      exercises: rows.map(r => ({ exerciseId: r.exerciseId, setCount: r.setCount })),
    }
    if (modal?.type === 'edit') {
      await updateMut.mutateAsync({ id: modal.routine.id, data: payload })
    } else {
      await createMut.mutateAsync(payload)
    }
    forceClose()
  }

  const isPending = createMut.isPending || updateMut.isPending
  const filteredEx = exercises?.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase()))

  return (
    <div>
      <PageHeader
        title="Routinen"
        back
        action={
          <button onClick={openCreate} className="text-indigo-400 hover:text-indigo-300">
            <Plus size={24} />
          </button>
        }
      />

      <div className="p-4">
        {isLoading && <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">Laden…</p>}

        {!isLoading && routines?.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
            Noch keine Routinen. Erstelle deine erste!
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {routines?.map(r => (
            <div
              key={r.id}
              className="flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 min-h-[120px]"
            >
              <div>
                <p className="font-semibold text-gray-800 dark:text-zinc-100 leading-snug">{r.name}</p>
                <p className="mt-1 text-sm text-gray-400 dark:text-zinc-500">{r.exercises.length} Übungen</p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  to={`/workouts/session?routine=${r.id}`}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                  <Play size={11} fill="white" />
                  Starten
                </Link>
                <button
                  onClick={() => openEdit(r)}
                  className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-indigo-400 transition-colors"
                >
                  <Pencil size={13} />
                  Bearbeiten
                </button>
                <button
                  onClick={() => deleteMut.mutate(r.id)}
                  disabled={deleteMut.isPending}
                  className="ml-auto text-gray-300 dark:text-zinc-700 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Routine create/edit modal */}
      {modal && !showExPicker && createPortal(
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          onClick={tryClose}
        >
          <div
            className="flex flex-col rounded-t-2xl bg-white dark:bg-zinc-900 mb-16"
            style={{ maxHeight: 'calc(90vh - 4rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
              <h3 className="font-semibold text-gray-800 dark:text-zinc-100">
                {modal.type === 'edit' ? 'Routine bearbeiten' : 'Neue Routine'}
              </h3>
              <button onClick={tryClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              <Input
                label="Name"
                placeholder="Push Day"
                value={name}
                onChange={e => setName(e.target.value)}
              />

              {rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600 dark:text-zinc-400">Übungen</p>
                  {rows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-zinc-800 px-3 py-2">
                      <GripVertical size={14} className="text-gray-300 dark:text-zinc-600 flex-shrink-0" />
                      <span className="flex-1 text-sm text-gray-800 dark:text-zinc-100 truncate">{row.exerciseName}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={row.setCount}
                          onChange={e => updateSetCount(idx, e.target.value)}
                          className="w-12 h-8 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center text-sm text-gray-800 dark:text-zinc-100 outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-gray-400 dark:text-zinc-500">Sets</span>
                      </div>
                      <button onClick={() => removeRow(idx)} className="text-gray-400 hover:text-red-400 flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={openPicker}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 py-2.5 text-sm text-gray-400 dark:text-zinc-500 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors"
              >
                <Plus size={15} />
                Übung hinzufügen
              </button>

              <div className="flex gap-2 pb-safe">
                <Button variant="secondary" className="flex-1" onClick={tryClose}>
                  Abbrechen
                </Button>
                <Button
                  className="flex-1"
                  loading={isPending}
                  onClick={save}
                  disabled={!name.trim() || rows.length === 0}
                >
                  {modal.type === 'edit' ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Exercise picker — replaces routine modal when open */}
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
              <h3 className="font-semibold text-gray-800 dark:text-zinc-100">
                {showCreateEx ? 'Neue Übung' : 'Übung wählen'}
              </h3>
              <div className="flex items-center gap-1">
                {!showCreateEx && (
                  <button
                    onClick={() => setShowSearch(s => !s)}
                    className={`rounded-lg p-2 transition-colors ${showSearch ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'text-gray-400 hover:text-indigo-500'}`}
                  >
                    <Search size={18} />
                  </button>
                )}
                <button
                  onClick={showCreateEx ? () => setShowCreateEx(false) : closePicker}
                  className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {showSearch && !showCreateEx && (
              <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
                <Input placeholder="Suchen…" value={exSearch} onChange={e => setExSearch(e.target.value)} autoFocus />
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-3">
              {!showCreateEx ? (
                <div className="space-y-1">
                  {filteredEx?.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => pickExercise(ex.id, ex.name)}
                      disabled={rows.some(r => r.exerciseId === ex.id)}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
                    >
                      <span className="font-medium text-gray-800 dark:text-zinc-100">{ex.name}</span>
                      <span className="ml-2 text-xs text-gray-400 dark:text-zinc-500">
                        {ex.muscles.filter(m => m.isPrimary).map(m => m.name).join(', ')}
                      </span>
                    </button>
                  ))}
                  {filteredEx?.length === 0 && (
                    <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-600">Nichts gefunden.</p>
                  )}
                  <button
                    onClick={() => { setShowCreateEx(true); setShowSearch(false) }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700 py-2.5 text-sm text-gray-400 dark:text-zinc-500 hover:border-indigo-500/60 hover:text-indigo-400 transition-colors mt-2"
                  >
                    <Plus size={15} />
                    Neue Übung erstellen
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-1">
                  <input
                    autoFocus
                    value={newExName}
                    onChange={e => setNewExName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateEx()}
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
                      onClick={handleCreateEx}
                      disabled={!newExName.trim() || createExMut.isPending}
                      className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                    >
                      {createExMut.isPending ? 'Erstellen…' : 'Erstellen & hinzufügen'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm close */}
      {confirmClose && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xl">
            <p className="font-semibold text-gray-800 dark:text-zinc-100">Änderungen verwerfen?</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-zinc-500">Nicht gespeicherte Eingaben gehen verloren.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmClose(false)}>
                Weiter bearbeiten
              </Button>
              <Button className="flex-1 !bg-red-500 hover:!bg-red-600" onClick={forceClose}>
                Verwerfen
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
