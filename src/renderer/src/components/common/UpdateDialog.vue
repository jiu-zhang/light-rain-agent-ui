<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded'

const state = ref<UpdateState>('idle')
const version = ref('')
const progress = ref(0)
const visible = ref(false)

function onUpdateAvailable(info: { version: string; releaseDate: string }): void {
  version.value = info.version
  state.value = 'available'
  visible.value = true
}

function onDownloadProgress(p: { percent: number }): void {
  state.value = 'downloading'
  progress.value = p.percent
}

function onUpdateDownloaded(info: { version: string }): void {
  version.value = info.version
  state.value = 'downloaded'
  progress.value = 100
}

const progressPercent = computed(() => `${Math.round(progress.value)}%`)

function startDownload(): void {
  window.api.startUpdateDownload()
}

function restartNow(): void {
  window.api.restartAndInstall()
}

function postpone(): void {
  visible.value = false
  state.value = 'idle'
}

onMounted(() => {
  window.api.onUpdateAvailable(onUpdateAvailable)
  window.api.onUpdateDownloadProgress(onDownloadProgress)
  window.api.onUpdateDownloaded(onUpdateDownloaded)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="update-overlay" @click.self="postpone">
        <div class="update-dialog">
          <!-- Ambient glow -->
          <div class="glow" />

          <!-- Header -->
          <div class="dialog-header">
            <div class="icon-ring">
              <svg class="update-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <!-- download arrow -->
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div class="header-text">
              <span class="title">发现新版本</span>
              <span class="version-badge">v{{ version }}</span>
            </div>
          </div>

          <!-- Content -->
          <div class="dialog-body">
            <!-- State: Available -->
            <template v-if="state === 'available'">
              <p class="desc">新版本已就绪，是否立即下载更新？</p>
              <div class="info-row">
                <span class="info-label">当前版本</span>
                <span class="info-value">{{ version }}</span>
              </div>
              <button class="btn-primary" @click="startDownload">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                下载更新
              </button>
              <button class="btn-secondary" @click="postpone">稍后提醒</button>
            </template>

            <!-- State: Downloading -->
            <template v-if="state === 'downloading'">
              <p class="desc">正在下载新版本...</p>
              <div class="progress-wrap">
                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: progressPercent }" />
                </div>
                <span class="progress-text">{{ progressPercent }}</span>
              </div>
              <p class="hint">下载完成后即可安装更新</p>
            </template>

            <!-- State: Downloaded -->
            <template v-if="state === 'downloaded'">
              <div class="check-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p class="desc">更新已下载完成！</p>
              <p class="hint">重启应用即可完成更新</p>
              <button class="btn-primary" @click="restartNow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                立即重启
              </button>
              <button class="btn-secondary" @click="postpone">稍后再说</button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-overlay {
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

.update-dialog {
  position: relative;
  width: 380px;
  max-width: 90vw;
  background: var(--bg-elevated, #1a1b26);
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.08));
  border-radius: 20px;
  padding: 32px 28px 24px;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.glow {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.12), transparent 70%);
  pointer-events: none;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.icon-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary, #818cf8);
  flex-shrink: 0;
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.update-icon {
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #e2e8f0);
  letter-spacing: -0.01em;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-primary, #818cf8);
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 10px;
  border-radius: 20px;
  width: fit-content;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
}

.desc {
  font-size: 14px;
  color: var(--text-secondary, #94a3b8);
  line-height: 1.6;
  margin: 0;
}

.info-row {
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  width: 100%;
  padding: 10px 16px;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.03));
  border-radius: 10px;
}

.info-label {
  color: var(--text-tertiary, #64748b);
}

.info-value {
  color: var(--text-primary, #e2e8f0);
  font-weight: 600;
}

/* Download progress */
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 0 4px;
}

.progress-track {
  flex: 1;
  height: 6px;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.06));
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 10px;
  background: linear-gradient(90deg, #6366f1, #a855f7, #6366f1);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  transition: width 0.3s ease;
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.progress-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-primary, #818cf8);
  min-width: 40px;
  text-align: right;
}

.hint {
  font-size: 12px;
  color: var(--text-tertiary, #64748b);
  margin: 0;
}

/* Check icon for downloaded state */
.check-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.05));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.15);
  margin-top: -4px;
}

/* Buttons */
.btn-primary {
  width: 100%;
  padding: 11px 0;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: white;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  width: 100%;
  padding: 10px 0;
  border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.06));
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: var(--bg-tertiary, rgba(255, 255, 255, 0.03));
  color: var(--text-secondary, #94a3b8);
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--border-accent, rgba(99, 102, 241, 0.3));
  color: var(--text-primary, #e2e8f0);
  background: rgba(255, 255, 255, 0.05);
}

/* Transition */
.dialog-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.dialog-leave-active {
  transition: all 0.15s ease;
}
.dialog-enter-from {
  opacity: 0;
}
.dialog-enter-from .update-dialog {
  transform: scale(0.92);
}
.dialog-leave-to {
  opacity: 0;
}
</style>
