import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Dumbbell, UserCircle } from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/habits', icon: CheckSquare, label: 'Habits' },
  { to: '/workouts', icon: Dumbbell, label: 'Workout' },
  { to: '/profile', icon: UserCircle, label: 'Profil' },
]

export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
        <div className="flex h-16 items-stretch">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-indigo-400" />
                  )}
                  <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
