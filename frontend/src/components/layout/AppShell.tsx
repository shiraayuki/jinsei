import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Dumbbell, Scale, Moon, UserCircle } from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/habits', icon: CheckSquare, label: 'Habits' },
  { to: '/workouts', icon: Dumbbell, label: 'Sport' },
  { to: '/weight', icon: Scale, label: 'Gewicht' },
  { to: '/sleep', icon: Moon, label: 'Schlaf' },
  { to: '/profile', icon: UserCircle, label: 'Profil' },
]

export function AppShell() {
  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 bg-zinc-950/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold tracking-wide transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-10 bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
                  )}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${isActive ? 'bg-indigo-500/10' : ''}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  </div>
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
