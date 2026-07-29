/**
 * 应用入口
 * <p>
 * 初始化 Vue 应用、路由、状态管理。
 * </p>
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import './styles/global.css'

const app = createApp(App)

app.use(router)
app.use(pinia)

app.mount('#app')
