/**
 * Pinia Store 统一导出
 */
import { createPinia } from 'pinia'

const pinia = createPinia()

export default pinia
export { useChatStore } from './chat'
export { useUiStore, MODE_OPTIONS } from './ui'
export type { AppMode } from './ui'
