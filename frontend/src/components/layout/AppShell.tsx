import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Dumbbell, UtensilsCrossed } from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/habits', icon: CheckSquare, label: 'Habits' },
  { to: '/workouts', icon: Dumbbell, label: 'Workout' },
  { to: '/food', icon: UtensilsCrossed, label: 'Essen' },
]

export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur">
        <div className="flex h-16 items-stretch">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
                }`
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
