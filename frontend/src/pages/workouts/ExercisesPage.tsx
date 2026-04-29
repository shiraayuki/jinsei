import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import {
  useExercises,
  useMuscleGroups,
  useCreateExercise,
  useUpdateExercise,
  useDeleteExercise,
} from '../../features/workouts/hooks'
import type { Exercise } from '../../features/workouts/api'

interface ExerciseFormState {
  name: string
  equipment: string
  selectedMuscles: { id: number; primary: boolean }[]
}

const emptyForm: ExerciseFormState = { name: '', equipment: '', selectedMuscles: [] }

type ModalMode = { type: 'create' } | { type: 'edit'; exercise: Exercise } | null

export function ExercisesPage() {
  const { data: exercises, isLoading } = useExercises()
  const { data: muscleGroups } = useMuscleGroups()
  const createMut = useCreateExercise()
  const updateMut = useUpdateExercise()
  const deleteMut = useDeleteExercise()

  const [modal, setModal] = useState<ModalMode>(null)
  const [form, setForm] = useState<ExerciseFormState>(emptyForm)
  const [confirmClose, setConfirmClose] = useState(false)

  function openCreate() {
    setForm(emptyForm)
    setModal({ type: 'create' })
    setConfirmClose(false)
  }

  function openEdit(ex: Exercise) {
    setForm({
      name: ex.name,
      equipment: ex.equipment ?? '',
      selectedMuscles: ex.muscles.map(m => ({ id: m.id, primary: m.isPrimary })),
    })
    setModal({ type: 'edit', exercise: ex })
    setConfirmClose(false)
  }

  function tryClose() {
    setConfirmClose(true)
  }

  function forceClose() {
    setModal(null)
    setConfirmClose(false)
    setForm(emptyForm)
  }

  function toggleMuscle(id: number) {
    setForm(prev => {
      const sel = prev.selectedMuscles
      const exists = sel.find(m => m.id === id)
      if (!exists) return { ...prev, selectedMuscles: [...sel, { id, primary: true }] }
      if (exists.primary) return { ...prev, selectedMuscles: sel.map(m => m.id === id ? { ...m, primary: false } : m) }
      return { ...prev, selectedMuscles: sel.filter(m => m.id !== id) }
    })
  }

  async function save() {
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      equipment: form.equipment || undefined,
      muscles: form.selectedMuscles.map(m => ({ muscleGroupId: m.id, isPrimary: m.primary })),
    }
    if (modal?.type === 'edit') {
      await updateMut.mutateAsync({ id: modal.exercise.id, data: payload })
    } else {
      await createMut.mutateAsync(payload)
    }
    forceClose()
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div>
      <PageHeader
        title="Übungen"
        back
        action={
          <button onClick={openCreate} className="text-indigo-400 hover:text-indigo-300">
            <Plus size={24} />
          </button>
        }
      />

      <div className="space-y-3 p-4">
        {isLoading && <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">Laden…</p>}

        {exercises?.map(ex => (
          <Card key={ex.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-800 dark:text-zinc-100">{ex.name}</p>
                {ex.isCustom && (
                  <span className="rounded-full bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-gray-400 dark:text-zinc-500">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500">
                {ex.muscles.map(m => `${m.name}${!m.isPrimary ? ' (sek.)' : ''}`).join(', ')}
                {ex.equipment && ` · ${ex.equipment}`}
              </p>
            </div>
            {ex.isCustom && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(ex)}
                  className="text-gray-400 dark:text-zinc-600 hover:text-indigo-400"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => deleteMut.mutate(ex.id)}
                  disabled={deleteMut.isPending}
                  className="text-gray-400 dark:text-zinc-600 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </Card>
        ))}

        {!isLoading && exercises?.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
            Noch keine Übungen. Erstelle deine erste!
          </p>
        )}
      </div>

      {/* Create/Edit modal — portal to body to escape backdrop-filter containing block */}
      {modal && createPortal(
        <div
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          onClick={tryClose}
        >
          <div
            className="rounded-t-2xl bg-white dark:bg-zinc-900 flex flex-col mb-16"
            style={{ maxHeight: 'calc(85vh - 4rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
              <h3 className="font-semibold text-gray-800 dark:text-zinc-100">
                {modal.type === 'edit' ? 'Übung bearbeiten' : 'Neue Übung'}
              </h3>
              <button onClick={tryClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              <Input
                label="Name"
                placeholder="Bankdrücken"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
              <Input
                label="Ausrüstung"
                placeholder="Langhantel"
                value={form.equipment}
                onChange={e => setForm(p => ({ ...p, equipment: e.target.value }))}
              />

              <div>
                <p className="mb-2 text-sm text-gray-500 dark:text-zinc-400">Muskelgruppen</p>
                <div className="flex flex-wrap gap-1.5">
                  {muscleGroups?.map(mg => {
                    const sel = form.selectedMuscles.find(m => m.id === mg.id)
                    return (
                      <button
                        key={mg.id}
                        onClick={() => toggleMuscle(mg.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                          sel
                            ? sel.primary
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-900/50 text-indigo-300'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {mg.name}
                        {sel && !sel.primary && ' (sek.)'}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
                  Einmal = primär · nochmal = sekundär · nochmal = entfernen
                </p>
              </div>

              <div className="flex gap-2 pb-safe">
                <Button variant="secondary" className="flex-1" onClick={tryClose}>
                  Abbrechen
                </Button>
                <Button
                  className="flex-1"
                  loading={isPending}
                  onClick={save}
                  disabled={!form.name.trim()}
                >
                  {modal.type === 'edit' ? 'Speichern' : 'Erstellen'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm discard — portal to body */}
      {confirmClose && createPortal(
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
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
