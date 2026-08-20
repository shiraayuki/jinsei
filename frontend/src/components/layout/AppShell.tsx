import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, CalendarDays, Dumbbell, LineChart } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

export function AppShell() {
  const { t } = useTranslation()
  // Four destinations: the overview, habits, everything that is logged per day,
  // and the training log. Profile lives in the dashboard header — it is opened
  // rarely and does not deserve a permanent slot.
  const NAV = [
    { to: '/', icon: LayoutDashboard, label: t('nav.home') },
    { to: '/habits', icon: CheckSquare, label: t('nav.habits') },
    { to: '/today', icon: CalendarDays, label: t('nav.today') },
    { to: '/workouts', icon: Dumbbell, label: t('nav.workouts') },
    { to: '/metrics', icon: LineChart, label: t('nav.metrics') },
  ]
  return (
    <div className="flex h-dvh flex-col app-bg">
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: 'var(--safe-top)',
          paddingBottom: 'var(--bottom-nav-total)',
        }}
      >
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 nav-bg border-t border-black/[0.06] dark:border-white/[0.04]"
        style={{
          backdropFilter: 'blur(20px)',
          // Keep the labels clear of the home indicator.
          paddingBottom: 'var(--safe-bottom)',
          paddingLeft: 'var(--safe-left)',
          paddingRight: 'var(--safe-right)',
        }}
      >
        <div
          className="mx-auto grid max-w-lg grid-cols-5"
          style={{ minHeight: 'var(--bottom-nav-height)' }}
        >
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="relative flex flex-col items-center justify-center gap-1 py-2"
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
                      size={21}
                      strokeWidth={isActive ? 2.2 : 1.7}
                      className={isActive ? 'text-indigo-400' : 'text-gray-400 dark:text-zinc-600'}
                    />
                    <span className={`text-[11px] font-semibold tracking-wide ${isActive ? 'text-indigo-400' : 'text-gray-400 dark:text-zinc-600'}`}>
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
