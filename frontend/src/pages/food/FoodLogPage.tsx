import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'

export function FoodLogPage() {
  return (
    <div>
      <PageHeader
        title="Ernährung"
        action={
          <Link to="/food/search" className="text-indigo-400 hover:text-indigo-300">
            <Search size={20} />
          </Link>
        }
      />
      <div className="p-4 text-zinc-500 text-sm">Mahlzeiten-Log – kommt bald.</div>
    </div>
  )
}
