import { useState } from 'react'
import { useAuth } from '../app/auth/AuthProvider'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LogOut } from 'lucide-react'

export function ProfilePage() {
  const { user, logout, updateProfile } = useAuth()
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
            <p className="text-xs text-zinc-500">E-Mail</p>
            <p className="mt-0.5 text-zinc-300">{user?.email}</p>
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

        <Button variant="danger" className="w-full" onClick={logout}>
          <LogOut size={16} />
          Abmelden
        </Button>
      </div>
    </div>
  )
}
