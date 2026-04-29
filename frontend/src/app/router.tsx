import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { HabitsListPage } from '../pages/habits/HabitsListPage'
import { HabitDetailPage } from '../pages/habits/HabitDetailPage'
import { HabitFormPage } from '../pages/habits/HabitFormPage'
import { WorkoutsListPage } from '../pages/workouts/WorkoutsListPage'
import { WorkoutDetailPage } from '../pages/workouts/WorkoutDetailPage'
import { WorkoutFormPage } from '../pages/workouts/WorkoutFormPage'
import { WorkoutSessionPage } from '../pages/workouts/WorkoutSessionPage'
import { ExercisesPage } from '../pages/workouts/ExercisesPage'
import { RoutinesPage } from '../pages/workouts/RoutinesPage'
import { ProfilePage } from '../pages/ProfilePage'
import { WeightPage } from '../pages/weight/WeightPage'
import { SleepPage } from '../pages/sleep/SleepPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center text-zinc-500">Laden…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function AppRouter() {
  const { user, loading } = useAuth()

  if (loading) return <div className="flex h-screen items-center justify-center text-zinc-500">Laden…</div>

  return (
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
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/routines" element={<RoutinesPage />} />
        <Route path="/weight" element={<WeightPage />} />
        <Route path="/sleep" element={<SleepPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
