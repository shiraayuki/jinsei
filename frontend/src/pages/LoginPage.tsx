import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../app/auth/AuthProvider'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

const schema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(8, 'Mind. 8 Zeichen'),
})

type Fields = z.infer<typeof schema>

export function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) })

  async function onSubmit(data: Fields) {
    setError('')
    try {
      if (mode === 'login') await login(data.email, data.password)
      else await register(data.email, data.password)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-400">Jinsei</h1>
          <p className="mt-1 text-sm text-zinc-500">Dein Leben, getrackt.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="E-Mail"
            type="email"
            autoComplete="email"
            placeholder="du@example.com"
            error={errors.email?.message}
            {...field('email')}
          />
          <Input
            label="Passwort"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            error={errors.password?.message}
            {...field('password')}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
            {mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </Button>
        </form>

        <button
          onClick={() => setMode(m => (m === 'login' ? 'register' : 'login'))}
          className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-300"
        >
          {mode === 'login' ? 'Noch kein Account? Registrieren' : 'Schon registriert? Anmelden'}
        </button>
      </div>
    </div>
  )
}
