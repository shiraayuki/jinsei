import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './app/auth/AuthProvider'
import { ThemeProvider } from './app/theme/ThemeProvider'
import { AppRouter } from './app/router'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { queryClient } from './app/queryClient'
import { resetColdStartRoute } from './lib/coldStart'
import './index.css'

// A lazy route whose chunk is missing (the client is running a build that has
// since been replaced) rejects with no UI of its own, leaving a blank page that
// only an app restart clears. Reload once to pick up the current build.
const RELOAD_KEY = 'jinsei:chunkReloadAt'

window.addEventListener('vite:preloadError', event => {
  event.preventDefault()
  // Reloading again right away would loop if the chunk is missing for some
  // other reason, so only retry when the last attempt was long enough ago to
  // be a different deploy rather than the same failure repeating.
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  if (Date.now() - last < 60_000) return
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  window.location.reload()
})

resetColdStartRoute()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
