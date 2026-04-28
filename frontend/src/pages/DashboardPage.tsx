import { useAuth } from '../app/auth/AuthProvider'
import { PageHeader } from '../components/ui/PageHeader'

export function DashboardPage() {
  const { user } = useAuth()
  const name = user?.displayName ?? user?.email?.split('@')[0] ?? 'du'

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="p-4">
        <p className="text-zinc-400 text-sm">
          Hallo, <span className="text-zinc-200 font-medium">{name}</span> 👋
        </p>
        <p className="mt-4 text-zinc-600 text-sm">Hier wird die Tages-Übersicht erscheinen.</p>
      </div>
    </div>
  )
}
