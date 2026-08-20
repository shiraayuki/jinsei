import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppShell } from '../components/layout/AppShell'

const LoginPage         = lazy(() => import('../pages/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage     = lazy(() => import('../pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const HabitsListPage    = lazy(() => import('../pages/habits/HabitsListPage').then(m => ({ default: m.HabitsListPage })))
const HabitDetailPage   = lazy(() => import('../pages/habits/HabitDetailPage').then(m => ({ default: m.HabitDetailPage })))
const HabitFormPage     = lazy(() => import('../pages/habits/HabitFormPage').then(m => ({ default: m.HabitFormPage })))
const WorkoutsListPage  = lazy(() => import('../pages/workouts/WorkoutsListPage').then(m => ({ default: m.WorkoutsListPage })))
const WorkoutDetailPage = lazy(() => import('../pages/workouts/WorkoutDetailPage').then(m => ({ default: m.WorkoutDetailPage })))
const TodayPage         = lazy(() => import('../pages/today/TodayPage').then(m => ({ default: m.TodayPage })))
const ProfilePage       = lazy(() => import('../pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const WeeklyReviewPage  = lazy(() => import('../pages/WeeklyReviewPage').then(m => ({ default: m.WeeklyReviewPage })))

const PageFallback = () => (
  <div className="flex h-dvh items-center justify-center text-zinc-500">Laden…</div>
)

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageFallback />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function AppRouter() {
  const { user, loading } = useAuth()

  if (loading) return <PageFallback />

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/habits" element={<HabitsListPage />} />
          <Route path="/habits/new" element={<HabitFormPage />} />
          <Route path="/habits/:id" element={<HabitDetailPage />} />
          <Route path="/habits/:id/edit" element={<HabitFormPage />} />
          <Route path="/workouts" element={<WorkoutsListPage />} />
          <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
          <Route path="/today" element={<TodayPage />} />
          {/* The metrics used to have a page each; keep the old paths working. */}
          <Route path="/nutrition" element={<Navigate to="/today" replace />} />
          <Route path="/weight" element={<Navigate to="/today" replace />} />
          <Route path="/sleep" element={<Navigate to="/today" replace />} />
          <Route path="/review" element={<WeeklyReviewPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
