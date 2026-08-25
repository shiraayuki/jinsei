import { useState } from 'react'
import { useAuth } from '../app/auth/AuthProvider'
import { useTheme } from '../app/theme/ThemeProvider'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function numOrNull(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

type Field = [label: string, unit: string, value: string, set: (v: string) => void, step: string]

/**
 * Declared outside the card: a component defined in a render body is a new type
 * on every render, so React would remount the inputs and typing would lose the
 * caret after each keystroke.
 */
function Fields({ items }: { items: Field[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, unit, value, setValue, step]) => (
        <label key={label} className="flex min-w-0 flex-col gap-1">
          <span className="text-meta text-ink-mute">{label}</span>
          <div className="flex items-baseline gap-1 rounded-control bg-raised px-3 py-2.5">
            <input
              type="number"
              inputMode="decimal"
              step={step}
              placeholder="–"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full min-w-0 bg-transparent text-title font-semibold text-ink outline-none"
            />
            {unit && <span className="text-meta text-ink-mute">{unit}</span>}
          </div>
        </label>
      ))}
    </div>
  )
}

/**
 * The targets every chart draws its line from.
 *
 * Split in two because they are set at different moments: the daily numbers get
 * revisited when a diet changes, the training and body ones when a block does.
 * An empty field means no target, not zero — the line simply does not appear.
 */
function GoalsCard() {
  const { user, updateProfile } = useAuth()
  const { t } = useTranslation()
  const [kcal, setKcal] = useState(user?.kcalGoal == null ? '' : String(user.kcalGoal))
  const [protein, setProtein] = useState(user?.proteinGoal == null ? '' : String(user.proteinGoal))
  const [water, setWater] = useState(user?.waterGoalL == null ? '' : String(user.waterGoalL))
  const [steps, setSteps] = useState(user?.stepsGoal == null ? '' : String(user.stepsGoal))
  // Sleep is stored in minutes but entered in hours, which is how a bedtime is
  // decided.
  const [sleep, setSleep] = useState(
    user?.sleepGoalMinutes == null ? '' : String(Math.round((user.sleepGoalMinutes / 60) * 100) / 100),
  )
  const [weight, setWeight] = useState(user?.weightGoalKg == null ? '' : String(user.weightGoalKg))
  const [workouts, setWorkouts] = useState(user?.weeklyWorkoutsGoal == null ? '' : String(user.weeklyWorkoutsGoal))
  const [sets, setSets] = useState(user?.weeklySetsGoal == null ? '' : String(user.weeklySetsGoal))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      const sleepHours = numOrNull(sleep)
      await updateProfile({
        kcalGoal: numOrNull(kcal),
        proteinGoal: numOrNull(protein),
        waterGoalL: numOrNull(water),
        stepsGoal: numOrNull(steps),
        sleepGoalMinutes: sleepHours == null ? null : Math.round(sleepHours * 60),
        weightGoalKg: numOrNull(weight),
        weeklyWorkoutsGoal: numOrNull(workouts),
        weeklySetsGoal: numOrNull(sets),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const daily: Field[] = [
    [t('goals.kcal'), 'kcal', kcal, setKcal, '10'],
    [t('goals.protein'), 'g', protein, setProtein, '5'],
    [t('goals.water'), 'L', water, setWater, '0.25'],
    [t('goals.steps'), '', steps, setSteps, '500'],
    [t('goals.sleep'), 'h', sleep, setSleep, '0.25'],
  ]

  const training: Field[] = [
    [t('goals.weight'), 'kg', weight, setWeight, '0.5'],
    [t('goals.weeklyWorkouts'), '', workouts, setWorkouts, '1'],
    [t('goals.weeklySets'), '', sets, setSets, '5'],
  ]

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-body font-medium text-ink-soft">{t('goals.title')}</p>
        <p className="mt-0.5 text-meta text-ink-mute">{t('goals.hint')}</p>
      </div>

      <p className="text-label font-semibold uppercase tracking-widest text-ink-faint">{t('goals.daily')}</p>
      <Fields items={daily} />

      <p className="pt-1 text-label font-semibold uppercase tracking-widest text-ink-faint">{t('goals.training')}</p>
      <Fields items={training} />

      <Button onClick={save} loading={saving} className="w-full">
        {saved ? t('common.saved') : t('common.save')}
      </Button>
    </Card>
  )
}

export function ProfilePage() {
  const { user, logout, updateProfile } = useAuth()
  const { theme, toggle } = useTheme()
  const { t } = useTranslation()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [language, setLanguage] = useState(user?.language ?? 'en')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile({ displayName, language })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('profile.title')} />

      <div className="space-y-4 p-4">
        <GoalsCard />

        <Card className="space-y-4 p-4">
          <div>
            <p className="text-meta text-ink-mute">{t('profile.email')}</p>
            <p className="mt-0.5 text-ink-soft">{user?.email}</p>
          </div>

          <Input
            label={t('profile.displayName')}
            placeholder={t('profile.displayNamePlaceholder')}
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />

          <Button onClick={save} loading={saving} className="w-full">
            {saved ? t('common.saved') : t('common.save')}
          </Button>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-body font-medium text-ink-soft">{t('profile.appearance')}</p>
            <p className="text-meta text-ink-mute">{theme === 'dark' ? t('profile.dark') : t('profile.light')}</p>
          </div>
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-control bg-raised text-ink-soft hover:bg-line transition-colors"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <p className="text-body font-medium text-ink-soft">{t('profile.language')}</p>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            onBlur={() => { if (language !== user?.language) save() }}
            className="rounded-chip bg-raised px-3 py-1.5 text-body text-ink-soft outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </Card>

        <Button variant="danger" className="w-full" onClick={logout}>
          <LogOut size={16} />
          {t('profile.signOut')}
        </Button>
      </div>
    </div>
  )
}
