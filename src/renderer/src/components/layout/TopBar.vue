<script setup lang="ts">
import Icon from '@renderer/components/common/Icon.vue'

defineProps<{ execActive?: boolean }>()

defineEmits<{ openSettings: []; newSession: []; toggleExec: [] }>()
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <div class="logo">
        <div class="logo-icon">
          <Icon name="sparkles" :size="18" />
        </div>
        <span class="logo-text">Light Rain</span>
      </div>
      <button class="new-chat-btn" title="新对话" @click="$emit('newSession')">
        <Icon name="plus" :size="15" />
        <span>新对话</span>
      </button>
    </div>
    <div class="topbar-right">
      <button
        class="exec-btn"
        :class="{ active: execActive }"
        title="执行面板"
        @click="$emit('toggleExec')"
      >
        <Icon name="activity" :size="16" />
        <span>执行</span>
      </button>
      <button class="gear-btn" title="设置" @click="$emit('openSettings')">
        <Icon name="settings" :size="18" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* 右侧 176px 预留原生窗口控制按钮（最小化/最大化/关闭）区域 */
  padding: 14px 176px 14px 24px;
  /* 隐藏原生标题栏后，顶栏作为窗口拖拽区 */
  -webkit-app-region: drag;
  user-select: none;
  transition: opacity 0.3s var(--ease-out);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
  cursor: default;
}

.logo:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

.logo-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--accent-gradient-tech);
  color: white;
  box-shadow: var(--glow-accent-sm);
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-instant);
}

.new-chat-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb), 0.1);
  box-shadow: var(--glow-accent-sm);
}

.new-chat-btn:active {
  transform: scale(0.96);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.exec-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-instant);
}

.exec-btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: var(--bg-hover);
}

.exec-btn:active {
  transform: scale(0.96);
}

.exec-btn.active {
  border-color: var(--border-accent);
  color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb), 0.1);
  box-shadow: var(--glow-accent-sm);
}

.gear-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  pointer-events: auto;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-instant);
}

.gear-btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: var(--bg-hover);
}

.gear-btn:hover :deep(svg) {
  transform: rotate(60deg);
}

.gear-btn :deep(svg) {
  transition: transform 0.4s var(--ease-out);
}

.gear-btn:active {
  transform: scale(0.92);
}
</style>
