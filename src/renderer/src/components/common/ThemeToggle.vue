<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getThemeMode, setThemeMode, type ThemeMode } from '@renderer/utils'
import Icon, { type IconName } from '@renderer/components/common/Icon.vue'

const currentMode = ref<ThemeMode>('system')

const themeOptions: { mode: ThemeMode; icon: IconName; label: string; gradient: string }[] = [
  {
    mode: 'light',
    icon: 'sun',
    label: '浅色',
    gradient: 'linear-gradient(135deg, #fbbf24, #f97316)'
  },
  {
    mode: 'dark',
    icon: 'moon',
    label: '深色',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)'
  },
  {
    mode: 'system',
    icon: 'monitor',
    label: '跟随系统',
    gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)'
  }
]

function selectMode(mode: ThemeMode): void {
  currentMode.value = mode
  setThemeMode(mode)
}

onMounted(() => {
  currentMode.value = getThemeMode()
})
</script>

<template>
  <div class="theme-switcher">
    <button
      v-for="opt in themeOptions"
      :key="opt.mode"
      class="theme-opt"
      :class="{ active: currentMode === opt.mode }"
      :title="opt.label"
      @click="selectMode(opt.mode)"
    >
      <div class="opt-icon" :style="{ background: opt.gradient }">
        <Icon :name="opt.icon" :size="13" />
      </div>
    </button>
  </div>
</template>

<style scoped>
.theme-switcher {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-full);
}

.theme-opt {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
}

.theme-opt:hover {
  transform: scale(1.15);
}

.theme-opt.active {
  background: var(--accent-gradient);
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.35);
}

.opt-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.theme-opt:hover .opt-icon {
  transform: rotate(15deg);
}

.theme-opt.active .opt-icon {
  background: white !important;
  color: var(--accent-primary) !important;
}
</style>
