import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import {
  useExercises,
  useMuscleGroups,
  useCreateExercise,
  useDeleteExercise,
} from '../../features/workouts/hooks'

export function ExercisesPage() {
  const { data: exercises, isLoading } = useExercises()
  const { data: muscleGroups } = useMuscleGroups()
  const createMut = useCreateExercise()
  const deleteMut = useDeleteExercise()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState('')
  const [selectedMuscles, setSelectedMuscles] = useState<{ id: number; primary: boolean }[]>([])

  function toggleMuscle(id: number, primary: boolean) {
    setSelectedMuscles(prev => {
      const exists = prev.find(m => m.id === id)
      if (exists) return prev.filter(m => m.id !== id)
      return [...prev, { id, primary }]
    })
  }

  async function create() {
    if (!name.trim()) return
    await createMut.mutateAsync({
      name: name.trim(),
      equipment: equipment || undefined,
      muscles: selectedMuscles.map(m => ({ muscleGroupId: m.id, isPrimary: m.primary })),
    })
    setName('')
    setEquipment('')
    setSelectedMuscles([])
    setShowForm(false)
  }

  return (
    <div>
      <PageHeader
        title="Übungen"
        back
        action={
          <button
            onClick={() => setShowForm(s => !s)}
            className="text-indigo-400 hover:text-indigo-300"
          >
            <Plus size={24} />
          </button>
        }
      />

      <div className="space-y-3 p-4">
        {/* Create form */}
        {showForm && (
          <Card className="space-y-3 p-4">
            <p className="font-medium text-gray-700 dark:text-zinc-200">Neue Übung</p>
            <Input label="Name" placeholder="Bankdrücken" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Equipment" placeholder="Langhantel" value={equipment} onChange={e => setEquipment(e.target.value)} />

            {/* Muscle group picker */}
            <div>
              <p className="mb-2 text-sm text-gray-500 dark:text-zinc-400">Muskelgruppen</p>
              <div className="flex flex-wrap gap-1.5">
                {muscleGroups?.map(mg => {
                  const sel = selectedMuscles.find(m => m.id === mg.id)
                  return (
                    <button
                      key={mg.id}
                      onClick={() => toggleMuscle(mg.id, !sel?.primary)}
                      className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                        sel
                          ? sel.primary
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-900/50 text-indigo-300'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:bg-zinc-700'
                      }`}
                    >
                      {mg.name}
                      {sel && !sel.primary && ' (sek.)'}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">Einmal = primär, nochmal = sekundär, nochmal = entfernen</p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
              <Button
                className="flex-1"
                loading={createMut.isPending}
                onClick={create}
                disabled={!name.trim()}
              >
                Erstellen
              </Button>
            </div>
          </Card>
        )}

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
              <button
                onClick={() => deleteMut.mutate(ex.id)}
                disabled={deleteMut.isPending}
                className="text-gray-400 dark:text-zinc-600 hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            )}
          </Card>
        ))}

        {!isLoading && exercises?.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-zinc-500">
            Noch keine Übungen. Erstelle deine erste!
          </p>
        )}
      </div>
    </div>
  )
}
