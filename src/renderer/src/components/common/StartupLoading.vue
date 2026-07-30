<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { setBackendPort } from '@renderer/api/index'

declare const __APP_VERSION__: string

const visible = ref(true)
const status = ref('正在启动服务...')
const dots = ref('')

onMounted(() => {
  // 每隔 5 秒更新状态提示，让用户知道还在启动
  const messages = [
    '正在启动服务...',
    '后端服务加载中...',
    '即将就绪...'
  ]
  let msgIdx = 0
  const msgTimer = setInterval(() => {
    msgIdx = Math.min(msgIdx + 1, messages.length - 1)
    status.value = messages[msgIdx]
  }, 5000)

  // 等待后端就绪
  window.api.onBackendReady(({ port }) => {
    setBackendPort(port)
    clearInterval(msgTimer)
    // 淡出动画后隐藏
    visible.value = false
  })

  // 点动动画
  setInterval(() => {
    dots.value = dots.value.length >= 3 ? '' : dots.value + '.'
  }, 600)
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="loading-screen">
      <!-- 背景雨滴动画 -->
      <div class="rain-bg">
        <div v-for="i in 20" :key="i" class="raindrop" :style="{
          left: Math.random() * 100 + '%',
          animationDelay: Math.random() * 3 + 's',
          animationDuration: 1.5 + Math.random() * 1 + 's'
        }" />
      </div>

      <!-- 中央内容 -->
      <div class="center-content">
        <!-- Logo glow -->
        <div class="logo-ring">
          <div class="logo-glow" />
          <svg class="logo-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>

        <h1 class="app-name">LightRain</h1>
        <p class="status-text">{{ status }}{{ dots }}</p>

        <!-- 进度条 -->
        <div class="progress-bar">
          <div class="progress-fill" />
        </div>
      </div>

      <!-- 版本号 -->
      <p class="version">v{{ __APP_VERSION__ }}</p>
    </div>
  </Transition>
</template>

<style scoped>
.loading-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: linear-gradient(160deg, #070b1a 0%, #0e1628 50%, #0a0f22 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* 雨滴背景 */
.rain-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.raindrop {
  position: absolute;
  top: -20px;
  width: 2px;
  height: 20px;
  background: linear-gradient(180deg, transparent, rgba(99, 102, 241, 0.15));
  border-radius: 1px;
  animation: rain linear infinite;
}

@keyframes rain {
  0% { transform: translateY(-20px); opacity: 0; }
  20% { opacity: 0.6; }
  80% { opacity: 0.6; }
  100% { transform: translateY(100vh); opacity: 0; }
}

/* 中央内容 */
.center-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  z-index: 10;
}

/* Logo */
.logo-ring {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.logo-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.2), transparent 70%);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
}

.logo-icon {
  color: #818cf8;
  z-index: 1;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.app-name {
  font-size: 28px;
  font-weight: 800;
  color: #e2e8f0;
  letter-spacing: 2px;
  margin: 0;
  background: linear-gradient(135deg, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.status-text {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  font-weight: 400;
}

/* 进度条 */
.progress-bar {
  width: 200px;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  width: 30%;
  border-radius: 10px;
  background: linear-gradient(90deg, #6366f1, #a855f7, #6366f1);
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
}

@keyframes loading {
  0% { transform: translateX(-100%); width: 30%; }
  50% { width: 60%; }
  100% { transform: translateX(400%); width: 30%; }
}

.version {
  position: absolute;
  bottom: 32px;
  font-size: 12px;
  color: #334155;
  margin: 0;
}

/* 淡出动画 */
.fade-leave-active {
  transition: opacity 0.6s ease;
}
.fade-leave-to {
  opacity: 0;
}
</style>
