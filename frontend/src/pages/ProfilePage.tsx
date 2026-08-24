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

/** Daily targets. An empty field means no target, not zero. */
function GoalsCard() {
  const { user, updateProfile } = useAuth()
  const { t } = useTranslation()
  const [kcal, setKcal] = useState(user?.kcalGoal == null ? '' : String(user.kcalGoal))
  const [protein, setProtein] = useState(user?.proteinGoal == null ? '' : String(user.proteinGoal))
  const [water, setWater] = useState(user?.waterGoalL == null ? '' : String(user.waterGoalL))
  const [steps, setSteps] = useState(user?.stepsGoal == null ? '' : String(user.stepsGoal))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile({
        kcalGoal: numOrNull(kcal),
        proteinGoal: numOrNull(protein),
        waterGoalL: numOrNull(water),
        stepsGoal: numOrNull(steps),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const fields: [string, string, string, (v: string) => void, string][] = [
    [t('goals.kcal'), 'kcal', kcal, setKcal, '10'],
    [t('goals.protein'), 'g', protein, setProtein, '5'],
    [t('goals.water'), 'L', water, setWater, '0.25'],
    [t('goals.steps'), '', steps, setSteps, '500'],
  ]

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-body font-medium text-ink-soft">{t('goals.title')}</p>
        <p className="mt-0.5 text-meta text-ink-mute">{t('goals.hint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {fields.map(([label, unit, value, setValue, step]) => (
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
