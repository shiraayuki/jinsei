import { useState } from 'react'
import { useAuth } from '../app/auth/AuthProvider'
import { useTheme } from '../app/theme/ThemeProvider'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LogOut, Sun, Moon } from 'lucide-react'

export function ProfilePage() {
  const { user, logout, updateProfile } = useAuth()
  const { theme, toggle } = useTheme()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile(displayName)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Profil" />

      <div className="space-y-4 p-4">
        <Card className="space-y-4 p-4">
          <div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">E-Mail</p>
            <p className="mt-0.5 text-gray-600 dark:text-zinc-300">{user?.email}</p>
          </div>

          <Input
            label="Anzeigename"
            placeholder="Dein Name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />

          <Button onClick={save} loading={saving} className="w-full">
            {saved ? '✓ Gespeichert' : 'Speichern'}
          </Button>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">Design</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{theme === 'dark' ? 'Dunkles Design' : 'Helles Design'}</p>
          </div>
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </Card>

        <Button variant="danger" className="w-full" onClick={logout}>
          <LogOut size={16} />
          Abmelden
        </Button>
      </div>
    </div>
  )
}
