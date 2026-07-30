<script setup lang="ts">
import { ref } from 'vue'
import SettingsGeneral from '@renderer/components/settings/SettingsGeneral.vue'
import SettingsModels from '@renderer/components/settings/SettingsModels.vue'
import SettingsSessions from '@renderer/components/settings/SettingsSessions.vue'
import SettingsAbout from '@renderer/components/settings/SettingsAbout.vue'

const emit = defineEmits<{ close: [] }>()

const activeTab = ref('general')

const tabs = [
  { id: 'general', icon: '🎨', label: '通用' },
  { id: 'models', icon: '🤖', label: '模型' },
  { id: 'sessions', icon: '💬', label: '对话历史' },
  { id: 'about', icon: 'ℹ️', label: '关于' }
]
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">设置</h2>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="tabs-sidebar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-item"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>
        <div class="tab-content">
          <div class="content-scroll">
            <SettingsGeneral v-if="activeTab === 'general'" />
            <SettingsModels v-else-if="activeTab === 'models'" />
            <SettingsSessions v-else-if="activeTab === 'sessions'" @close="$emit('close')" />
            <SettingsAbout v-else-if="activeTab === 'about'" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayIn 0.25s ease;
}
@keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
.modal-container {
  width: 760px; max-width: 94vw; height: 580px; max-height: 86vh;
  background: var(--bg-elevated); backdrop-filter: blur(32px);
  border: 1px solid var(--border-strong); border-radius: 20px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: var(--shadow-glass-lg);
  animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px; border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}
.modal-title { font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; }
.close-btn {
  width: 32px; height: 32px; border: 1px solid var(--border-glass);
  background: var(--bg-tertiary); color: var(--text-secondary); border-radius: 50%;
  cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.close-btn:hover { border-color: var(--accent-error); color: var(--accent-error); background: color-mix(in srgb, var(--accent-error) 10%, transparent); transform: rotate(90deg); }
.modal-body { flex: 1; display: flex; overflow: hidden; }
.tabs-sidebar { width: 150px; flex-shrink: 0; padding: 12px 8px; border-right: 1px solid var(--border-color); background: var(--bg-secondary); }
.tab-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px; border: none; background: transparent; color: var(--text-secondary); font-size: 13px; font-weight: 500; border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.tab-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.tab-item.active { background: linear-gradient(135deg, rgba(96, 165, 250, 0.2), rgba(52, 211, 153, 0.1)); color: var(--accent-primary); box-shadow: 0 4px 12px rgba(96, 165, 250, 0.15); }
.tab-icon { font-size: 16px; }
.tab-label { font-weight: 600; }
.tab-content { flex: 1; overflow: hidden; }
.content-scroll { height: 100%; overflow-y: auto; padding: 16px 20px; }
</style>
