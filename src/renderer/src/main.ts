/**
 * 应用入口
 * <p>
 * 初始化 Vue 应用、路由、状态管理、全局错误处理。
 * </p>
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import { notifyError } from './utils/feedback'
import { getChatPrefs, applyChatPrefs } from '@renderer/utils'
import 'highlight.js/styles/github-dark.min.css'
import './styles/global.css'

// 应用聊天显示偏好（消息密度/字号）
applyChatPrefs(getChatPrefs())

const app = createApp(App)

// 全局错误边界：Vue 渲染/生命周期/侦听器错误统一兜底
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue error]', info, err)
  notifyError(err instanceof Error ? err.message : '页面渲染出错')
}

// 未处理的 Promise 拒绝兜底（拦截器已统一提示业务错误，这里只记录，避免重复弹窗）
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled rejection]', event.reason)
})

app.use(router)
app.use(pinia)

app.mount('#app')
