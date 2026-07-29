export type Theme = 'dark' | 'light'
export type ThemeMode = Theme | 'system'

const THEME_KEY = 'agent-ui-theme'
const THEME_MODE_KEY = 'agent-ui-theme-mode'
let systemMql: MediaQueryList | null = null

export function initTheme(): void {
  const mode = (localStorage.getItem(THEME_MODE_KEY) as ThemeMode) || 'system'
  applyThemeMode(mode)
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_MODE_KEY, theme)
  applyThemeMode(theme)
}

export function getTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) || 'dark'
}

export function getThemeMode(): ThemeMode {
  return (localStorage.getItem(THEME_MODE_KEY) as ThemeMode) || 'system'
}

export function setThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_MODE_KEY, mode)
  applyThemeMode(mode)
}

function applyThemeMode(mode: ThemeMode): void {
  // 清除旧的 system 主题监听器
  if (systemMql) {
    systemMql.onchange = null
    systemMql = null
  }

  let theme: Theme
  if (mode === 'system') {
    theme = getSystemTheme()
    systemMql = window.matchMedia('(prefers-color-scheme: dark)')
    systemMql.onchange = (e) => {
      if (getThemeMode() === 'system') {
        applyTheme(e.matches ? 'dark' : 'light')
      }
    }
  } else {
    theme = mode
  }
  applyTheme(theme)
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.setAttribute('data-theme', theme)
}
