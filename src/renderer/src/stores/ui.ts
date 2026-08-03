/**
 * 全局 UI 状态：应用模式
 *
 * 四种模式定义：
 * - standard 标准：完整侧边栏 + 所有功能入口（默认）
 * - minimal  极简：图标折叠侧边栏，最大化对话区域
 * - immersive 沉浸：无侧边栏，鼠标悬停左缘显示临时抽屉
 * - focus    专注：纯净对话 + 径向光晕，仅保留核心交互
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type AppMode = 'standard' | 'minimal' | 'immersive' | 'focus'

const MODE_KEY = 'agent-ui-mode'

export const MODE_OPTIONS: { value: AppMode; label: string; desc: string; icon: string }[] = [
  { value: 'standard', label: '标准', desc: '完整侧边栏', icon: 'monitor' },
  { value: 'minimal', label: '极简', desc: '折叠侧边栏', icon: 'focus' },
  { value: 'immersive', label: '沉浸', desc: '鼠标悬停呼出', icon: 'target' },
  { value: 'focus', label: '专注', desc: '纯净对话', icon: 'sparkles' }
]

export const useUiStore = defineStore('ui', () => {
  const mode = ref<AppMode>(loadMode())

  function loadMode(): AppMode {
    try {
      const saved = localStorage.getItem(MODE_KEY) as AppMode | null
      if (saved && MODE_OPTIONS.some((o) => o.value === saved)) return saved
    } catch {
      // ignore
    }
    return 'standard'
  }

  function setMode(next: AppMode): void {
    mode.value = next
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // ignore
    }
  }

  /** 循环切换模式（用于快捷键） */
  function cycleMode(): void {
    const idx = MODE_OPTIONS.findIndex((o) => o.value === mode.value)
    const next = MODE_OPTIONS[(idx + 1) % MODE_OPTIONS.length]
    setMode(next.value)
  }

  return { mode, setMode, cycleMode }
})
