import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../../lib/api'

export interface User {
  id: string
  email: string
  displayName?: string
}

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (displayName: string) => Promise<void>
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const u = await api.post<User>('/auth/login', { email, password })
    setUser(u)
  }

  async function register(email: string, password: string, displayName?: string) {
    const u = await api.post<User>('/auth/register', { email, password, displayName })
    setUser(u)
  }

  async function logout() {
    await api.post('/auth/logout')
    setUser(null)
  }

  async function updateProfile(displayName: string) {
    const u = await api.put<User>('/auth/profile', { displayName })
    setUser(u)
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
