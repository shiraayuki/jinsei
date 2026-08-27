import { createContext, useContext, useState, useEffect } from 'react'
import { PALETTES, type Palette } from '../../lib/palettes'
import { type ThemePreference } from '../../lib/theme'

/** What is actually on screen once 'system' has been asked what it wants. */
type Theme = 'dark' | 'light'

interface ThemeContextValue {
  /** The resolved appearance, for anything that needs to know which one is up. */
  theme: Theme
  preference: ThemePreference
  palette: Palette
  setPreference: (preference: ThemePreference) => void
  setPalette: (palette: Palette) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  preference: 'system',
  palette: 'apple',
  setPreference: () => {},
  setPalette: () => {},
})

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemTheme(): Theme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  } catch {
    // Test environments and very old browsers have no matchMedia; the app was
    // dark before this existed, so that is what "no answer" means.
    return 'dark'
  }
}

function storedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem('jinsei:theme')
    // Anything else — including the key never having been written — follows
    // the system, which is the default the same way it is on iOS.
    return value === 'dark' || value === 'light' ? value : 'system'
  } catch {
    return 'system'
  }
}

function storedPalette(): Palette {
  try {
    const value = localStorage.getItem('jinsei:palette')
    return PALETTES.includes(value as Palette) ? (value as Palette) : 'apple'
  } catch {
    return 'apple'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(storedPreference)
  const [system, setSystem] = useState<Theme>(systemTheme)
  const [palette, setPalette] = useState<Palette>(storedPalette)

  const theme: Theme = preference === 'system' ? system : preference

  // The system's answer is not a one-off reading: it changes at sunset on a
  // phone set to switch automatically, and the app has to follow it while it
  // is open rather than only at the next start.
  useEffect(() => {
    let media: MediaQueryList
    try {
      media = window.matchMedia(DARK_QUERY)
    } catch {
      return
    }
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    // The browser chrome around the page, which no stylesheet reaches. It
    // cannot be left to a media query any more: an explicitly light app on a
    // dark phone would get a black bar over a white page.
    document.getElementById('theme-color')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f2f2f7')
  }, [theme])

  useEffect(() => {
    // 'system' is stored as the absence of a decision, which is also what the
    // script in index.html reads it as: one meaning, in one place.
    try {
      if (preference === 'system') localStorage.removeItem('jinsei:theme')
      else localStorage.setItem('jinsei:theme', preference)
    } catch {
      /* an appearance is a preference, not state we owe anyone */
    }
  }, [preference])

  useEffect(() => {
    // Apple is the default and therefore has no attribute of its own: the
    // tokens on :root are already it, and every other palette overrides them.
    const root = document.documentElement
    if (palette === 'apple') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', palette)

    try {
      localStorage.setItem('jinsei:palette', palette)
    } catch {
      /* the palette is a preference, not state we owe anyone */
    }
  }, [palette])

  return (
    <ThemeContext.Provider value={{ theme, preference, palette, setPreference, setPalette }}>
      {children}
    </ThemeContext.Provider>
  )
}

// The hook belongs with the provider it reads; splitting it costs more than
// the lost hot update while this file is being edited.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext)
}
