/**
 * 聊天显示偏好（消息密度 / 字号）
 */

export type ChatDensity = 'comfortable' | 'compact'
export type ChatFontSize = 'small' | 'medium' | 'large'

export interface ChatPrefs {
  density: ChatDensity
  fontSize: ChatFontSize
}

const PREFS_KEY = 'agent-ui-chat-prefs'

const DEFAULTS: ChatPrefs = { density: 'comfortable', fontSize: 'medium' }

/** 读取聊天显示偏好 */
export function getChatPrefs(): ChatPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatPrefs>
      return { ...DEFAULTS, ...parsed }
    }
  } catch {
    // 解析失败使用默认值
  }
  return { ...DEFAULTS }
}

/** 保存聊天显示偏好并应用 */
export function setChatPrefs(prefs: ChatPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  applyChatPrefs(prefs)
}

/** 将偏好应用到 CSS 变量 */
export function applyChatPrefs(prefs: ChatPrefs): void {
  const root = document.documentElement
  const gap = prefs.density === 'compact' ? '2px' : '8px'
  root.style.setProperty('--chat-msg-gap', gap)
  const sizes: Record<ChatFontSize, string> = { small: '13px', medium: '14px', large: '15px' }
  root.style.setProperty('--chat-font-size', sizes[prefs.fontSize])
}
