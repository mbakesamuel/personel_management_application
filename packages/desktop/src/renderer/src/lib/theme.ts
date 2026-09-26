export type Theme = 'agro' | 'dark'

export const THEME_STORAGE_KEY = 'perf-appraisal-theme'

export const DEFAULT_THEME: Theme = 'agro'

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'agro' || value === 'dark'
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }
}
