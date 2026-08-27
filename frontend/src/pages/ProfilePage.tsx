import { useState } from 'react'
import { useAuth } from '../app/auth/AuthProvider'
import { useTheme } from '../app/theme/ThemeProvider'
import { THEME_PREFERENCES } from '../lib/theme'
import { PALETTES } from '../lib/palettes'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RATE_PRESETS, rateKeyFor } from '../lib/energy'
import { api } from '../lib/api'
import { dateLocale } from '../i18n'

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

/**
 * The pace of the cut, as a share of body weight rather than a fixed number of
 * kilos: half a kilo a week is gentle at 100 kg and brutal at 60. The three
 * choices are the three things that happen to fat-free mass, which is the part
 * worth deciding about.
 */
function RateCard() {
  const { user, updateProfile } = useAuth()
  const { t } = useTranslation()
  const [saving, setSaving] = useState<string | null>(null)
  const active = rateKeyFor(user?.weeklyRatePercent ?? null)

  async function choose(percent: number | null, key: string) {
    setSaving(key)
    try {
      await updateProfile({ weeklyRatePercent: percent })
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-body font-medium text-ink-soft">{t('rate.title')}</p>
        <p className="mt-0.5 text-meta text-ink-mute">{t('rate.hint')}</p>
      </div>

      <div className="space-y-2">
        {RATE_PRESETS.map(preset => {
          const selected = active === preset.key && user?.weeklyRatePercent != null
          return (
            <button
              key={preset.key}
              onClick={() => choose(selected ? null : preset.percent, preset.key)}
              disabled={saving != null}
              aria-pressed={selected}
              className={`w-full rounded-control px-3 py-2.5 text-left transition-colors ${
                selected ? 'bg-accent text-white' : 'bg-raised hover:bg-line'
              }`}
            >
              <span className="flex items-baseline gap-2">
                <span className={`text-body font-medium ${selected ? 'text-white' : 'text-ink'}`}>
                  {t(`rate.levels.${preset.key}`)}
                </span>
                <span className={`ml-auto shrink-0 text-meta tabular ${selected ? 'text-white/80' : 'text-ink-mute'}`}>
                  {preset.percent.toLocaleString(dateLocale(), { minimumFractionDigits: 2 })} %
                </span>
              </span>
              <span className={`mt-0.5 block text-label ${selected ? 'text-white/75' : 'text-ink-faint'}`}>
                {t(`rate.effects.${preset.key}`)}
              </span>
            </button>
          )
        })}
      </div>

      <p className="text-label text-ink-faint">{t('rate.anchor')}</p>
    </Card>
  )
}

/**
 * The credential a phone shortcut carries. Shown once when it is issued and
 * never again — the server keeps only its hash, so "replace" is the only way
 * back, which is the right trade for a secret that lives next to its data.
 */
function IngestCard() {
  const { user, refresh } = useAuth()
  const { t } = useTranslation()
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function issue() {
    setBusy(true)
    try {
      const res = await api.post<{ token: string }>('/auth/ingest-token', {})
      setToken(res.token)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    setBusy(true)
    try {
      await api.delete('/auth/ingest-token')
      setToken(null)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access is refused often enough that the token stays on
      // screen to be selected by hand.
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-body font-medium text-ink-soft">{t('ingest.title')}</p>
        <p className="mt-0.5 text-meta text-ink-mute">{t('ingest.hint')}</p>
      </div>

      {token && (
        <div className="space-y-2 rounded-control bg-raised p-3">
          <p className="text-label text-warn">{t('ingest.onceOnly')}</p>
          <p className="break-all font-mono text-meta text-ink">{token}</p>
          <button
            onClick={() => copy(token)}
            className="w-full rounded-chip bg-line py-2 text-meta font-medium text-ink hover:bg-line-strong"
          >
            {copied ? t('common.saved') : t('ingest.copy')}
          </button>
        </div>
      )}

      <div className="space-y-1.5 rounded-control bg-raised p-3 text-label text-ink-mute">
        <p className="font-semibold uppercase tracking-widest text-ink-faint">{t('ingest.howTo')}</p>
        <p>{t('ingest.step1')}</p>
        <p>{t('ingest.step2')}</p>
        <p className="break-all font-mono text-ink-soft">POST {window.location.origin}/api/ingest/activity</p>
        <p className="break-all font-mono text-ink-soft">{'{"entries":[{"date":"2026-08-25","steps":10432}]}'}</p>
        <p>{t('ingest.step3')}</p>
      </div>

      <div className="flex gap-2">
        <Button onClick={issue} loading={busy} className="flex-1">
          {user?.hasIngestToken ? t('ingest.replace') : t('ingest.create')}
        </Button>
        {user?.hasIngestToken && (
          <Button variant="danger" onClick={revoke} loading={busy} className="flex-1">
            {t('ingest.revoke')}
          </Button>
        )}
      </div>
    </Card>
  )
}

export function ProfilePage() {
  const { user, logout, updateProfile } = useAuth()
  const { theme, preference, palette, setPreference, setPalette } = useTheme()
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
        <RateCard />
        <IngestCard />

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

        {/* Three states rather than a switch: light, dark, and the one every
            other app on the phone has — whatever the system is doing right
            now. The line underneath says which that turned out to be, so
            "automatic" is not a state you have to guess the effect of. */}
        <Card className="space-y-3 p-4">
          <div className="flex items-baseline gap-2">
            <p className="text-body font-medium text-ink-soft">{t('profile.appearance')}</p>
            {preference === 'system' ? (
              <p className="ml-auto min-w-0 truncate text-meta text-ink-mute">
                {t('profile.followsSystem', { mode: t(`profile.appearanceModes.${theme}`) })}
              </p>
            ) : (
              <span className="ml-auto shrink-0 text-ink-mute">
                {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
              </span>
            )}
          </div>
          <div className="segmented flex">
            {THEME_PREFERENCES.map(mode => (
              <button
                key={mode}
                onClick={() => setPreference(mode)}
                aria-pressed={preference === mode}
                className="segmented-item flex-1 py-1.5 text-meta"
              >
                {t(`profile.appearanceModes.${mode}`)}
              </button>
            ))}
          </div>
        </Card>

        {/* The palette is its own choice, independent of light and dark: each
            one brings both halves. The swatches are the actual tokens, so what
            is on the button is what the app will look like. */}
        <Card className="space-y-3 p-4">
          <p className="text-body font-medium text-ink-soft">{t('profile.palette')}</p>
          <div className="grid grid-cols-2 gap-2">
            {PALETTES.map(key => (
              <button
                key={key}
                onClick={() => setPalette(key)}
                aria-pressed={palette === key}
                className={`flex flex-col items-center gap-2 rounded-control p-3 transition-colors ${
                  palette === key ? 'bg-accent-soft' : 'bg-raised'
                }`}
              >
                <span className="flex gap-1">
                  {['sleep', 'food', 'move', 'train'].map(module => (
                    <span
                      key={module}
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ background: `var(--swatch-${key}-${module})` }}
                    />
                  ))}
                </span>
                <span className={`text-meta ${palette === key ? 'font-semibold text-accent' : 'text-ink-mute'}`}>
                  {t(`profile.palettes.${key}`)}
                </span>
              </button>
            ))}
          </div>
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
