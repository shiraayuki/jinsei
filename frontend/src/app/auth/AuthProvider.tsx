import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import i18n from '../../i18n'

export interface User {
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
  updateProfile: (displayName: string, language?: string) => Promise<void>
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

  async function updateProfile(displayName: string, language?: string) {
    const u = await api.put<User>('/auth/profile', { displayName, language })
    applyUser(u)
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  return useContext(Ctx)
}
