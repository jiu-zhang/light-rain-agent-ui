<script setup lang="ts">
import { ref, onMounted } from 'vue'

const visible = ref(false)

function show(): void {
  visible.value = true
}

function quit(): void {
  visible.value = false
  window.api.closeApp()
}

function hide(): void {
  visible.value = false
  window.api.hideToTray()
}

function cancel(): void {
  visible.value = false
}

onMounted(() => {
  window.api.onConfirmClose(() => show())
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="overlay" @click.self="cancel">
        <div class="dialog">
          <div class="header">
            <div class="icon-ring">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <span class="title">关闭确认</span>
          </div>

          <p class="message">关闭窗口后是否退出应用？</p>

          <div class="actions">
            <button class="btn btn-primary" @click="hide">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
              到后台运行
            </button>
            <button class="btn btn-danger" @click="quit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              退出应用
            </button>
          </div>

          <button class="cancel-link" @click="cancel">取消</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  width: 360px;
  max-width: 90vw;
  background: var(--bg-elevated, #1a1b26);
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.08));
  border-radius: 20px;
  padding: 28px 24px 20px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  width: 100%;
  justify-content: center;
}

.icon-ring {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f59e0b;
  flex-shrink: 0;
  border: 1px solid rgba(251, 191, 36, 0.15);
}

.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #e2e8f0);
  letter-spacing: -0.01em;
}

.message {
  font-size: 14px;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.6;
  margin: 0 0 20px;
}

.actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 0;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary {
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.06));
  color: var(--text-secondary, #94a3b8);
}

.btn-primary:hover {
  border-color: var(--border-accent, rgba(99, 102, 241, 0.3));
  color: var(--text-primary, #e2e8f0);
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.btn-danger {
  color: white;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25);
}

.btn-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.35);
}

.btn-danger:active {
  transform: translateY(0);
}

.cancel-link {
  margin-top: 14px;
  background: none;
  border: none;
  color: var(--text-tertiary, #64748b);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 0.2s ease;
}

.cancel-link:hover {
  color: var(--text-secondary, #94a3b8);
}

.dialog-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.dialog-leave-active {
  transition: all 0.15s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog {
  transform: scale(0.92);
}
</style>
