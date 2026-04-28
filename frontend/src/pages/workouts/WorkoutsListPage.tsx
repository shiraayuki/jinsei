import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'

export function WorkoutsListPage() {
  return (
    <div>
      <PageHeader
        title="Workouts"
        action={
          <Link to="/workouts/new" className="text-indigo-400 hover:text-indigo-300">
            <Plus size={22} />
          </Link>
        }
      />
      <div className="p-4 text-zinc-500 text-sm">Noch keine Workouts.</div>
    </div>
  )
}
