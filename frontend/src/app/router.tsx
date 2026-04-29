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
const WorkoutFormPage   = lazy(() => import('../pages/workouts/WorkoutFormPage').then(m => ({ default: m.WorkoutFormPage })))
const WorkoutSessionPage = lazy(() => import('../pages/workouts/WorkoutSessionPage').then(m => ({ default: m.WorkoutSessionPage })))
const WorkoutStatsPage  = lazy(() => import('../pages/workouts/WorkoutStatsPage').then(m => ({ default: m.WorkoutStatsPage })))
const ExercisesPage     = lazy(() => import('../pages/workouts/ExercisesPage').then(m => ({ default: m.ExercisesPage })))
const RoutinesPage      = lazy(() => import('../pages/workouts/RoutinesPage').then(m => ({ default: m.RoutinesPage })))
const WeightPage        = lazy(() => import('../pages/weight/WeightPage').then(m => ({ default: m.WeightPage })))
const SleepPage         = lazy(() => import('../pages/sleep/SleepPage').then(m => ({ default: m.SleepPage })))
const ProfilePage       = lazy(() => import('../pages/ProfilePage').then(m => ({ default: m.ProfilePage })))

const PageFallback = () => (
  <div className="flex h-screen items-center justify-center text-zinc-500">Laden…</div>
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
          <Route path="/workouts/new" element={<WorkoutFormPage />} />
          <Route path="/workouts/session" element={<WorkoutSessionPage />} />
          <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
          <Route path="/workouts/:id/edit" element={<WorkoutFormPage />} />
          <Route path="/workouts/stats" element={<WorkoutStatsPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/weight" element={<WeightPage />} />
          <Route path="/sleep" element={<SleepPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
