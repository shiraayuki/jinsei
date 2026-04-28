import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '../../components/ui/PageHeader'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useHabits, useCreateHabit, useUpdateHabit } from '../../features/habits/hooks'

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const COLORS = ['#6366f1', '#ec4899', '#f97316', '#22c55e', '#06b6d4', '#eab308', '#ef4444']

const schema = z.object({
  name: z.string().min(1, 'Pflichtfeld'),
  description: z.string().optional(),
  color: z.string().default('#6366f1'),
  icon: z.string().optional(),
  scheduleType: z.enum(['daily', 'weekly', 'interval']),
  targetCount: z.coerce.number().int().min(1).default(1),
  daysOfWeek: z.array(z.number()).optional(),
  intervalDays: z.coerce.number().int().min(1).optional(),
})

type Fields = z.infer<typeof schema>

export function HabitFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { data: habits } = useHabits()
  const createMutation = useCreateHabit()
  const updateMutation = useUpdateHabit()

  const existing = habits?.find(h => h.id === id)

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as Resolver<Fields>,
    defaultValues: {
      color: '#6366f1',
      scheduleType: 'daily',
      targetCount: 1,
    },
  })

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        description: existing.description,
        color: existing.color,
        icon: existing.icon,
        scheduleType: (existing.schedule?.type as Fields['scheduleType']) ?? 'daily',
        targetCount: existing.schedule?.targetCount ?? 1,
        daysOfWeek: existing.schedule?.daysOfWeek,
        intervalDays: existing.schedule?.intervalDays,
      })
    }
  }, [existing, reset])

  const scheduleType = watch('scheduleType')
  const selectedColor = watch('color')

  async function onSubmit(data: Fields) {
    const payload = {
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      schedule: {
        type: data.scheduleType,
        targetCount: data.targetCount,
        daysOfWeek: data.scheduleType === 'weekly' ? data.daysOfWeek : undefined,
        intervalDays: data.scheduleType === 'interval' ? data.intervalDays : undefined,
        activeFrom: new Date().toISOString().slice(0, 10),
      },
    }

    if (isEdit && id) {
      await updateMutation.mutateAsync({ id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    navigate('/habits')
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <PageHeader title={isEdit ? 'Habit bearbeiten' : 'Neuer Habit'} back />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-4">
        <Input
          label="Name"
          placeholder="z.B. Meditieren"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Beschreibung (optional)"
          placeholder="Kurze Notiz…"
          {...register('description')}
        />

        {/* Color picker */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-500 dark:text-zinc-400">Farbe</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => reset({ ...watch(), color: c })}
                className={`h-8 w-8 rounded-full transition-transform ${
                  selectedColor === c ? 'scale-125 ring-2 ring-white/50' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Icon */}
        <Input
          label="Icon (Emoji, optional)"
          placeholder="🏃"
          {...register('icon')}
        />

        {/* Schedule type */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-500 dark:text-zinc-400">Frequenz</label>
          <div className="grid grid-cols-3 gap-2">
            {(['daily', 'weekly', 'interval'] as const).map(t => (
              <label
                key={t}
                className={`flex cursor-pointer items-center justify-center rounded-xl border py-2 text-sm transition-colors ${
                  scheduleType === t
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                    : 'border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400'
                }`}
              >
                <input type="radio" value={t} {...register('scheduleType')} className="sr-only" />
                {t === 'daily' ? 'Täglich' : t === 'weekly' ? 'Wöchentlich' : 'Intervall'}
              </label>
            ))}
          </div>
        </div>

        {/* Weekly: day selector */}
        {scheduleType === 'weekly' && (
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-500 dark:text-zinc-400">Tage</label>
            <Controller
              name="daysOfWeek"
              control={control}
              defaultValue={[]}
              render={({ field }) => (
                <div className="flex gap-1">
                  {DAYS.map((d, i) => {
                    const selected = field.value?.includes(i) ?? false
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? (field.value ?? []).filter((x: number) => x !== i)
                            : [...(field.value ?? []), i]
                          field.onChange(next)
                        }}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:bg-zinc-700'
                        }`}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </div>
        )}

        {/* Interval days */}
        {scheduleType === 'interval' && (
          <Input
            label="Alle N Tage"
            type="number"
            min="1"
            placeholder="2"
            error={errors.intervalDays?.message}
            {...register('intervalDays')}
          />
        )}

        {/* Target count (weekly x-times) */}
        {scheduleType === 'weekly' && (
          <Input
            label="Ziel (Anzahl pro Tag)"
            type="number"
            min="1"
            {...register('targetCount')}
          />
        )}

        <Button type="submit" size="lg" loading={isPending || isSubmitting} className="w-full">
          {isEdit ? 'Speichern' : 'Erstellen'}
        </Button>
      </form>
    </div>
  )
}
