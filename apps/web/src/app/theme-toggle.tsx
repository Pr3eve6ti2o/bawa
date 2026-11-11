import { Button } from '../ui/components/button'
import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark'

const storageKey = 'token-ui-theme'
const themeColor: Record<ThemeMode, string> = {
  light: '#ffffff',
  dark: '#0c1637',
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem(storageKey)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function syncThemeColor(theme: ThemeMode) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.append(meta)
  }

  meta.content = themeColor[theme]
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(storageKey, theme)
    syncThemeColor(theme)
  }, [theme])

  return (
    <div
      aria-label="Theme"
      className="inline-flex rounded-full border border-border bg-card p-1 shadow-[var(--shadow-card)]"
      role="group"
    >
      <Button
        aria-pressed={theme === 'light'}
        className="h-8 px-3"
        onClick={() => setTheme('light')}
        size="sm"
        variant={theme === 'light' ? 'default' : 'ghost'}
      >
        Light
      </Button>
      <Button
        aria-pressed={theme === 'dark'}
        className="h-8 px-3"
        onClick={() => setTheme('dark')}
        size="sm"
        variant={theme === 'dark' ? 'default' : 'ghost'}
      >
        Dark
      </Button>
    </div>
  )
}

export { ThemeToggle }
