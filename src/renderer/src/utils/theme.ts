export type Theme = 'dark' | 'light'
export type ThemeMode = Theme | 'system' | 'custom'

const THEME_KEY = 'agent-ui-theme'
const THEME_MODE_KEY = 'agent-ui-theme-mode'
let systemMql: MediaQueryList | null = null

export function initTheme(): void {
  const mode = (localStorage.getItem(THEME_MODE_KEY) as ThemeMode) || 'system'
  applyThemeMode(mode)
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
    theme = mode === 'custom' ? 'dark' : mode
    if (mode === 'custom') {
      applyCustomThemeVars()
    }
  }
  applyTheme(theme)
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 获取自定义主题的变量值 */
export function getCustomThemeVars(): Record<string, string> {
  try {
    const stored = localStorage.getItem('agent-ui-custom-theme')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

/** 设置自定义主题的变量 */
export function setCustomThemeVar(key: string, value: string): void {
  const vars = getCustomThemeVars()
  vars[key] = value
  localStorage.setItem('agent-ui-custom-theme', JSON.stringify(vars))
  applyCustomThemeVars()
}

/** 应用自定义主题变量到页面 */
function applyCustomThemeVars(): void {
  const vars = getCustomThemeVars()
  const root = document.documentElement

  Object.entries(vars).forEach(([key, value]) => {
    if (key.startsWith('--')) {
      root.style.setProperty(key, value)
    }
  })
}

/** 重置自定义主题到默认 */
export function resetCustomTheme(): void {
  localStorage.removeItem('agent-ui-custom-theme')
  const root = document.documentElement
  const defaultVars = getDefaultThemeVars()

  Object.keys(defaultVars).forEach((key) => {
    if (key.startsWith('--')) {
      root.style.removeProperty(key)
    }
  })
}

/** 获取默认主题变量 */
function getDefaultThemeVars(): Record<string, string> {
  return {
    '--accent-primary': '#60a5fa',
    '--accent-success': '#22c55e',
    '--accent-error': '#ef4444',
    '--accent-warning': '#f59e0b'
  }
}

function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
  document.documentElement.setAttribute('data-theme', theme)
  syncNativeWindowTheme(theme)
}

/** 通知主进程同步原生窗口标题栏颜色与系统 UI 主题（浏览器/测试环境静默忽略） */
function syncNativeWindowTheme(theme: Theme): void {
  try {
    const mode = getThemeMode()
    const bg =
      getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() ||
      (theme === 'dark' ? '#0f0f12' : '#ffffff')
    window.api?.setTheme?.({ mode, theme, bg })
  } catch {
    // 无 electron 桥接时忽略
  }
}
