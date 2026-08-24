import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../app/auth/AuthProvider'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(8, 'Mind. 8 Zeichen'),
  displayName: z.string().optional(),
})

type Fields = z.infer<typeof loginSchema>

export function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loginSchema) as Resolver<Fields>,
  })

  async function onSubmit(data: Fields) {
    setError('')
    try {
      if (mode === 'login') {
        await login(data.email, data.password)
      } else {
        await register(data.email, data.password, data.displayName)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ground px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-accent">Jinsei</h1>
          <p className="mt-1 text-body text-ink-mute">Dein Leben, getrackt.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {mode === 'register' && (
            <Input
              label="Anzeigename"
              placeholder="Dein Name"
              autoComplete="name"
              error={errors.displayName?.message}
              {...field('displayName')}
            />
          )}
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

          {error && <p className="text-body text-bad">{error}</p>}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
            {mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </Button>
        </form>

        <button
          onClick={() => setMode(m => (m === 'login' ? 'register' : 'login'))}
          className="mt-4 w-full text-center text-body text-ink-mute hover:text-ink-soft"
        >
          {mode === 'login' ? 'Noch kein Account? Registrieren' : 'Schon registriert? Anmelden'}
        </button>
      </div>
    </div>
  )
}
