import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import i18n from '../../i18n'

export interface Goals {
  kcalGoal: number | null
  proteinGoal: number | null
  waterGoalL: number | null
  stepsGoal: number | null
  sleepGoalMinutes: number | null
  weightGoalKg: number | null
  weeklyWorkoutsGoal: number | null
  weeklySetsGoal: number | null
  /** Pace of the cut as a percentage of body weight per week. */
  weeklyRatePercent: number | null
}

/** What an energy formula needs and the daily logs cannot supply. */
export interface BodyProfileFields {
  birthDate: string | null
  heightCm: number | null
  /** "male", "female", or null when it was not given. */
  sex: string | null
  /** Multiplier on the resting rate, 1.2 (desk) to 1.9 (manual job plus training). */
  activityLevel: number | null
}

export interface User extends Goals, BodyProfileFields {
  /** Whether a phone shortcut can currently post data; the token itself is never returned. */
  hasIngestToken: boolean
  id: string
  email: string
  displayName?: string
  language: string
}

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  /** Re-reads the account, for changes the server made that no patch describes. */
  refresh: () => Promise<void>
  updateProfile: (
    patch: Partial<Goals> & Partial<BodyProfileFields> & { displayName?: string; language?: string },
  ) => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  function applyUser(u: User) {
    setUser(u)
    i18n.changeLanguage(u.language ?? 'en')
  }

  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then(applyUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const u = await api.post<User>('/auth/login', { email, password })
    applyUser(u)
  }

  async function register(email: string, password: string, displayName?: string) {
    const u = await api.post<User>('/auth/register', { email, password, displayName })
    applyUser(u)
  }

  async function logout() {
    await api.post('/auth/logout')
    setUser(null)
  }

  /**
   * The endpoint replaces every field it knows about, so anything not being
   * changed has to be sent back as it stands — otherwise saving a name would
   * clear the goals.
   */
  async function refresh() {
    const u = await api.get<User>('/auth/me')
    applyUser(u)
  }

  async function updateProfile(
    patch: Partial<Goals> & Partial<BodyProfileFields> & { displayName?: string; language?: string },
  ) {
    const u = await api.put<User>('/auth/profile', {
      displayName: user?.displayName ?? null,
      language: user?.language,
      kcalGoal: user?.kcalGoal ?? null,
      proteinGoal: user?.proteinGoal ?? null,
      waterGoalL: user?.waterGoalL ?? null,
      stepsGoal: user?.stepsGoal ?? null,
      sleepGoalMinutes: user?.sleepGoalMinutes ?? null,
      weightGoalKg: user?.weightGoalKg ?? null,
      weeklyWorkoutsGoal: user?.weeklyWorkoutsGoal ?? null,
      weeklySetsGoal: user?.weeklySetsGoal ?? null,
      weeklyRatePercent: user?.weeklyRatePercent ?? null,
      birthDate: user?.birthDate ?? null,
      heightCm: user?.heightCm ?? null,
      sex: user?.sex ?? null,
      activityLevel: user?.activityLevel ?? null,
      ...patch,
    })
    applyUser(u)
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, updateProfile }}>
      {children}
    </Ctx.Provider>
  )
}

// The hook belongs with the provider it reads; splitting it costs more than
// the lost hot update while this file is being edited.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(Ctx)
}
