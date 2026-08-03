<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { initTheme, getShortcut, matchesAccelerator, SHORTCUTS } from '@renderer/utils'
import { useUiStore } from '@renderer/stores'
import Sidebar from '@renderer/components/layout/Sidebar.vue'
import UpdateDialog from '@renderer/components/common/UpdateDialog.vue'
import CloseConfirm from '@renderer/components/common/CloseConfirm.vue'
import StartupLoading from '@renderer/components/common/StartupLoading.vue'

const ui = useUiStore()

/** 快捷键：循环切换模式 */
function onKeydown(e: KeyboardEvent): void {
  if (matchesAccelerator(e, getShortcut('cycleMode'))) {
    e.preventDefault()
    ui.cycleMode()
  }
}

onMounted(() => {
  initTheme()
  window.addEventListener('keydown', onKeydown)
  const toggleWindow = getShortcut('toggleWindow')
  const defaultWindow = SHORTCUTS.find((s) => s.id === 'toggleWindow')?.default ?? ''
  if (toggleWindow !== defaultWindow) {
    window.api.updateShortcut('toggleWindow', toggleWindow)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <StartupLoading />
  <div class="app-shell" :class="`is-${ui.mode}`">
    <Sidebar />
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>
  </div>
  <UpdateDialog />
  <CloseConfirm />
</template>

<style scoped>
.app-shell {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  transition:
    background-color 0.4s var(--ease-out),
    padding 0.3s var(--ease-out);
}

.app-main {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

/* ===== 各模式主内容区背景 ===== */

/* 标准模式：默认背景 */
.app-shell.is-standard .app-main {
  background: var(--bg-primary);
}

/* 极简模式：同标准，但侧边栏折叠已释放空间 */
.app-shell.is-minimal .app-main {
  background: var(--bg-primary);
}

/* 沉浸模式：纯净深色背景 */
.app-shell.is-immersive .app-main {
  background: var(--bg-primary);
}

/* 专注模式：纯色 + 径向光晕 */
.app-shell.is-focus .app-main {
  background: var(--bg-primary);
}

.app-shell.is-focus .app-main::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 60% 50% at 50% 0%,
    rgba(var(--accent-primary-rgb), 0.06),
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

/* 沉浸模式也有微弱光晕 */
.app-shell.is-immersive .app-main::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 50% 40% at 50% 0%,
    rgba(var(--accent-primary-rgb), 0.04),
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
}

/* 路由切换动效：滑入 + 淡入 + 轻微缩放 */
.page-enter-active {
  transition:
    opacity 0.28s var(--ease-out),
    transform 0.28s var(--ease-out);
}

.page-leave-active {
  transition:
    opacity 0.16s var(--ease-out),
    transform 0.16s var(--ease-out);
  position: absolute;
  inset: 0;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.99);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.99);
}
</style>
