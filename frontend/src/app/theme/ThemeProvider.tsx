import { createContext, useContext, useState, useEffect } from 'react'
import { PALETTES, type Palette } from '../../lib/palettes'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  palette: Palette
  toggle: () => void
  setPalette: (palette: Palette) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  palette: 'apple',
  toggle: () => {},
  setPalette: () => {},
})

function storedPalette(): Palette {
  try {
    const value = localStorage.getItem('jinsei:palette')
    return PALETTES.includes(value as Palette) ? (value as Palette) : 'apple'
  } catch {
    return 'apple'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('jinsei:theme') as Theme) ?? 'dark',
  )
  const [palette, setPalette] = useState<Palette>(storedPalette)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('jinsei:theme', theme)
  }, [theme])

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

  function toggle() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, palette, toggle, setPalette }}>
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
