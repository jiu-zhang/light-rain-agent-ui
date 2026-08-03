/**
 * 快捷键定义与管理（持久化到 localStorage，全局快捷键通过 IPC 同步给主进程）
 */

export interface ShortcutDef {
  id: string
  label: string
  default: string
  /** 是否由主进程注册（全局生效），false 为渲染进程快捷键 */
  global: boolean
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'toggleWindow', label: '唤起主窗口（全局）', default: 'Ctrl+Alt+L', global: true },
  { id: 'cycleMode', label: '循环切换界面模式', default: 'Ctrl+Alt+M', global: false }
]

const KEY = 'agent-ui-shortcuts'

/** 读取某个快捷键（无自定义时返回默认值） */
export function getShortcut(id: string): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const map = JSON.parse(raw) as Record<string, string>
      if (map && typeof map[id] === 'string' && map[id]) return map[id]
    }
  } catch {
    // 解析失败走默认
  }
  return SHORTCUTS.find((s) => s.id === id)?.default ?? ''
}

/** 保存某个快捷键 */
export function setShortcut(id: string, accelerator: string): void {
  try {
    const raw = localStorage.getItem(KEY)
    const map: Record<string, string> = raw ? JSON.parse(raw) : {}
    map[id] = accelerator
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // 持久化失败不影响本次会话
  }
}

/** 解析快捷键字符串（如 Ctrl+Alt+F） */
export function parseAccelerator(acc: string): {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  key: string
} | null {
  const parts = acc.split('+').map((p) => p.trim())
  const parsed = { ctrl: false, alt: false, shift: false, meta: false, key: '' }
  for (const p of parts) {
    const low = p.toLowerCase()
    if (['ctrl', 'control', 'commandorcontrol', 'cmdorctrl'].includes(low)) parsed.ctrl = true
    else if (['alt', 'option'].includes(low)) parsed.alt = true
    else if (low === 'shift') parsed.shift = true
    else if (['meta', 'cmd', 'command', 'super'].includes(low)) parsed.meta = true
    else parsed.key = low
  }
  return parsed.key ? parsed : null
}

/** 判断键盘事件是否匹配某个快捷键 */
export function matchesAccelerator(e: KeyboardEvent, acc: string): boolean {
  const p = parseAccelerator(acc)
  if (!p) return false
  return (
    e.ctrlKey === p.ctrl &&
    e.altKey === p.alt &&
    e.shiftKey === p.shift &&
    e.metaKey === p.meta &&
    e.key.toLowerCase() === p.key
  )
}

/** 将键盘事件转换为快捷键字符串（供录制） */
export function eventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Cmd')
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key === ' ' ? 'Space' : e.key
  parts.push(key)
  return parts.join('+')
}

/** 校验是否为合法的全局快捷键（必须含修饰键，且不是裸修饰键） */
export function isValidGlobalShortcut(acc: string): boolean {
  const p = parseAccelerator(acc)
  if (!p) return false
  return p.ctrl || p.alt || p.meta
}
