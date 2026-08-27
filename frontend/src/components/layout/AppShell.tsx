import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, CalendarDays, Dumbbell, LineChart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OutboxBanner } from './OutboxBanner'
import { useResumeToHome } from '../../app/useResumeToHome'

export function AppShell() {
  const { t } = useTranslation()
  useResumeToHome()
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
        <OutboxBanner />
        <Outlet />
      </main>

      {/*
        A tab bar, not a nav rail: a hairline over blurred material, five slots
        of equal width, and the selected one saying so in tint alone. The pill
        that used to slide between them is a web idiom — on iOS the icon and
        its label carry the state, which is also why they no longer move.
      */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 nav-bg hairline-t"
        style={{
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
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
              className="flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-1"
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={25}
                    strokeWidth={isActive ? 2.1 : 1.8}
                    className={isActive ? 'text-accent' : 'text-ink-mute'}
                  />
                  <span
                    className={`text-[10px] font-medium leading-none ${isActive ? 'text-accent' : 'text-ink-mute'}`}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
