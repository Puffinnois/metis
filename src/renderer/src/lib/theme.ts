import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'metis.theme'

/** The saved theme; light (the design default) when nothing is saved or storage is unavailable. */
export function savedTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/** Current theme plus a toggle that applies and remembers it. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(savedTheme)
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      try {
        localStorage.setItem(KEY, next)
      } catch {
        // per-viewer convenience only
      }
      return next
    })
  }, [])
  return [theme, toggle]
}
