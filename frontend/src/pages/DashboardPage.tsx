import { useAuth } from '../app/auth/AuthProvider'
import { PageHeader } from '../components/ui/PageHeader'
import { LogOut } from 'lucide-react'

export function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <div>
      <PageHeader
        title="Dashboard"
        action={
          <button onClick={logout} className="text-zinc-500 hover:text-zinc-300">
            <LogOut size={18} />
          </button>
        }
      />
      <div className="p-4">
        <p className="text-zinc-400 text-sm">
          Willkommen, <span className="text-zinc-200">{user?.email}</span>
        </p>
        <p className="mt-4 text-zinc-600 text-sm">Hier wird die Tages-Übersicht erscheinen.</p>
      </div>
    </div>
  )
}
