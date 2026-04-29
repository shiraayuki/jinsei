import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, Dumbbell, Scale, Moon, UserCircle } from 'lucide-react'
import { motion } from 'motion/react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Start' },
  { to: '/habits', icon: CheckSquare, label: 'Habits' },
  { to: '/workouts', icon: Dumbbell, label: 'Sport' },
  { to: '/weight', icon: Scale, label: 'Gewicht' },
  { to: '/sleep', icon: Moon, label: 'Schlaf' },
  { to: '/profile', icon: UserCircle, label: 'Profil' },
]

export function AppShell() {
  return (
    <div className="flex h-dvh flex-col app-bg">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 nav-bg border-t border-black/[0.06] dark:border-white/[0.04]"
        style={{ backdropFilter: 'blur(20px)' }}>
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="relative flex flex-col items-center justify-center gap-1 py-3"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="navPill"
                      className="absolute inset-x-1 inset-y-1 rounded-xl"
                      style={{ background: 'rgba(99,102,241,0.12)' }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                    />
                  )}
                  <motion.div
                    animate={{ scale: isActive ? 1.05 : 1 }}
                    transition={{ type: 'spring', bounce: 0.3, duration: 0.25 }}
                    className="relative flex flex-col items-center gap-1"
                  >
                    <Icon
                      size={19}
                      strokeWidth={isActive ? 2.2 : 1.7}
                      className={isActive ? 'text-indigo-400' : 'text-gray-400 dark:text-zinc-600'}
                    />
                    <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-indigo-400' : 'text-gray-400 dark:text-zinc-600'}`}>
                      {label}
                    </span>
                  </motion.div>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
