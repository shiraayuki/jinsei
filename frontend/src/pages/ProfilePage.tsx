import { useState } from 'react'
import { useAuth } from '../app/auth/AuthProvider'
import { useTheme } from '../app/theme/ThemeProvider'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LogOut, Sun, Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
      await updateProfile(displayName, language)
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
        <Card className="space-y-4 p-4">
          <div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{t('profile.email')}</p>
            <p className="mt-0.5 text-gray-600 dark:text-zinc-300">{user?.email}</p>
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
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">{t('profile.appearance')}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{theme === 'dark' ? t('profile.dark') : t('profile.light')}</p>
          </div>
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">{t('profile.language')}</p>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            onBlur={() => { if (language !== user?.language) save() }}
            className="rounded-lg bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500"
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
