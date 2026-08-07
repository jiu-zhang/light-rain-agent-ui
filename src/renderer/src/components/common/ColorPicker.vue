<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from './Icon.vue'

interface Props {
  modelValue: string
  label: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)

const currentColor = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 常用颜色预设
const colorPresets = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
  '#f97316', // orange
  '#22c55e', // green
  '#06b6d4', // cyan
  '#60a5fa', // light blue
  '#a78bfa' // purple
]

function selectPreset(color: string): void {
  currentColor.value = color
  isOpen.value = false
}

function closePicker(): void {
  isOpen.value = false
}

function handleClickOutside(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (isOpen.value && !target.closest('.color-picker')) {
    closePicker()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="color-picker">
    <button
      class="color-swatch"
      :style="{ background: currentColor }"
      @click.stop="isOpen = !isOpen"
    />

    <div v-if="isOpen" class="color-picker-dropdown" @click.stop>
      <div class="picker-header">
        <span class="picker-label">{{ label }}</span>
        <button class="close-btn" @click="closePicker">
          <Icon name="x" :size="14" />
        </button>
      </div>

      <div class="color-presets">
        <button
          v-for="color in colorPresets"
          :key="color"
          class="preset-btn"
          :style="{ background: color }"
          @click="selectPreset(color)"
        />
      </div>

      <div class="custom-section">
        <label class="custom-label">自定义颜色</label>
        <div class="custom-input">
          <input
            ref="inputRef"
            v-model="currentColor"
            type="color"
            class="color-input"
            @change="emit('update:modelValue', currentColor)"
          />
          <input v-model="currentColor" type="text" class="hex-input" maxlength="7" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-picker {
  position: relative;
  display: inline-block;
}

.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.color-swatch:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.color-picker-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  min-width: 180px;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(96, 165, 250, 0.06) inset;
  backdrop-filter: blur(24px) saturate(1.4);
  animation: slideDown 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.picker-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--accent-error);
  color: white;
}

.color-presets {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.preset-btn {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.custom-section {
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.custom-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.custom-input {
  display: flex;
  gap: 4px;
  align-items: center;
}

.color-input {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}

.hex-input {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 11px;
  font-family: var(--font-code);
}

.hex-input:focus {
  outline: none;
  border-color: var(--accent-primary);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
