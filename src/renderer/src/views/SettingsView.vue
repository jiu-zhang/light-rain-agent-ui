<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  getShortcut,
  setShortcut,
  SHORTCUTS,
  eventToAccelerator,
  isValidGlobalShortcut
} from '@renderer/utils'
import SettingsGeneral from '@renderer/components/settings/SettingsGeneral.vue'
import SettingsAbout from '@renderer/components/settings/SettingsAbout.vue'
import Icon, { type IconName } from '@renderer/components/common/Icon.vue'

const active = ref('general')

const sections: { id: string; label: string; icon: IconName }[] = [
  { id: 'general', label: '外观与对话', icon: 'palette' },
  { id: 'shortcuts', label: '快捷键', icon: 'keyboard' },
  { id: 'about', label: '关于', icon: 'info' }
]

// ─── 快捷键录制 ─────────────────────────────
const recordingId = ref<string | null>(null)
const recordError = ref('')

function startRecord(id: string): void {
  recordingId.value = id
  recordError.value = ''
}

function cancelRecord(): void {
  recordingId.value = null
  recordError.value = ''
}

function onRecordKeydown(e: KeyboardEvent): void {
  if (!recordingId.value) return
  e.preventDefault()
  e.stopPropagation()
  // 忽略裸修饰键，等待组合键按下
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

  const acc = eventToAccelerator(e)
  const def = SHORTCUTS.find((s) => s.id === recordingId.value)
  if (!def) return

  if (def.global && !isValidGlobalShortcut(acc)) {
    recordError.value = '全局快捷键必须包含 Ctrl / Alt / Cmd 修饰键'
    return
  }
  // 冲突检测：与另一个快捷键相同
  const conflict = SHORTCUTS.some((s) => s.id !== def.id && getShortcut(s.id) === acc)
  if (conflict) {
    recordError.value = `与「${SHORTCUTS.find((s) => s.id !== def.id && getShortcut(s.id) === acc)?.label ?? '其他'}」冲突`
    return
  }

  setShortcut(def.id, acc)
  // 全局快捷键同步给主进程立即生效
  if (def.global) {
    window.api.updateShortcut(def.id, acc)
  }
  recordingId.value = null
}

onMounted(() => {
  document.addEventListener('keydown', onRecordKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onRecordKeydown, true)
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">
        <Icon name="settings" :size="24" class="title-icon" />
        设置
      </h1>
      <p class="page-desc">外观、对话与系统偏好</p>
    </div>

    <div class="settings-layout">
      <div class="sections-nav">
        <button
          v-for="s in sections"
          :key="s.id"
          class="section-btn"
          :class="{ active: active === s.id }"
          @click="active = s.id"
        >
          <Icon :name="s.icon" :size="14" class="section-icon" />
          <span>{{ s.label }}</span>
        </button>
      </div>

      <div class="sections-content">
        <SettingsGeneral v-if="active === 'general'" />

        <div v-else-if="active === 'shortcuts'" class="section-block">
          <div class="section-label">
            <Icon name="keyboard" :size="12" />
            快捷键
          </div>
          <div v-for="s in SHORTCUTS" :key="s.id" class="shortcut-row">
            <span class="shortcut-desc">{{ s.label }}</span>
            <div class="shortcut-control">
              <template v-if="recordingId === s.id">
                <span class="record-hint">{{ recordError || '请按下新的组合键...' }}</span>
                <button class="kbd-btn" @click="cancelRecord">取消</button>
              </template>
              <template v-else>
                <span class="shortcut-keys">
                  <kbd v-for="k in getShortcut(s.id).split('+')" :key="k" class="kbd">{{ k }}</kbd>
                </span>
                <button class="kbd-btn" @click="startRecord(s.id)">修改</button>
              </template>
            </div>
          </div>
          <p class="shortcut-note">
            全局快捷键修改后立即生效；<kbd class="kbd">Enter</kbd> 发送、<kbd class="kbd"
              >Shift</kbd
            >
            + <kbd class="kbd">Enter</kbd> 换行为固定键位。
          </p>
        </div>

        <SettingsAbout v-else />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  padding: var(--space-lg) var(--space-xl);
  height: 100%;
  overflow-y: auto;
}

.page-header {
  margin-bottom: var(--space-lg);
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  color: var(--accent-primary);
}

.section-icon {
  color: var(--text-tertiary);
  transition: color 0.2s;
}

.section-btn:hover .section-icon {
  color: var(--text-secondary);
}

.section-btn.active .section-icon {
  color: var(--accent-primary);
}

.page-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.settings-layout {
  display: flex;
  gap: 32px;
  max-width: 900px;
}

.sections-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
  padding: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  height: fit-content;
}

.section-btn {
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.section-btn:hover {
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  color: var(--text-primary);
}

.section-btn.active {
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font-weight: 600;
}

.sections-content {
  flex: 1;
  min-width: 0;
}

.section-block {
  margin-bottom: 32px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  transition: all var(--transition-fast);
}

.shortcut-row:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.shortcut-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.shortcut-keys {
  display: flex;
  gap: 4px;
}

.shortcut-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kbd {
  padding: 2px 8px;
  background: var(--bg-quaternary);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--text-secondary);
}

.kbd-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.kbd-btn:hover {
  border-color: var(--border-accent);
  color: var(--accent-primary);
}

.record-hint {
  font-size: 12px;
  color: var(--accent-primary);
  font-weight: 500;
}

.shortcut-note {
  margin-top: 14px;
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.7;
}
</style>
