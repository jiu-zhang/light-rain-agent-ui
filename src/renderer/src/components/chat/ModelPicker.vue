<script setup lang="ts">
import Icon, { type IconName } from '@renderer/components/common/Icon.vue'
import type { ProviderWithSimpleModels } from '@renderer/types'

const props = defineProps<{
  show: boolean
  enabledProviders: ProviderWithSimpleModels[]
  selectedModelId: number | null
  currentModelLabel: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  select: [id: number]
}>()

/** 厂商图标映射 */
const providerIconMap: Record<string, IconName> = {
  deepseek: 'robot',
  openai: 'brain',
  dashscope: 'cpu',
  ollama: 'server',
  siliconflow: 'box'
}

const hasModels = (): boolean => props.enabledProviders.some((p) => (p.models || []).length > 0)
</script>

<template>
  <div
    class="command-btn model-chip"
    :class="{ active: show }"
    title="切换模型"
    @click.stop="emit('update:show', !show)"
  >
    <span class="model-dot" />
    <span class="model-name">{{ currentModelLabel }}</span>
    <Icon name="chevron-down" :size="13" class="model-arrow" />
    <div v-if="show" class="toolbar-dropdown" @click.stop>
      <div v-for="p in enabledProviders" :key="p.id" class="dropdown-group">
        <div v-if="(p.models || []).length" class="dropdown-group-label">{{ p.name }}</div>
        <div
          v-for="m in p.models || []"
          :key="m.id"
          class="dropdown-option"
          :class="{ active: selectedModelId === m.id }"
          @click="emit('select', m.id)"
        >
          <Icon :name="providerIconMap[p.code] || 'cpu'" :size="11" class="model-icon" />
          <span class="model-text">
            <span v-if="m.isDefault" class="dropdown-default"><Icon name="star" :size="10" /></span>
            {{ m.name }}
          </span>
        </div>
      </div>
      <div v-if="!hasModels()" class="dropdown-empty">暂无可用模型</div>
    </div>
  </div>
</template>

<style scoped>
.command-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  user-select: none;
  position: relative;
}
.command-btn:hover {
  border-color: var(--border-accent);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-primary) 6%, transparent);
}

/* 模型选择 */
.model-chip {
  gap: 6px;
  max-width: 200px;
}
.model-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, #60a5fa, #34d399);
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.7);
}
.model-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}
.model-arrow {
  color: var(--text-quaternary);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.model-chip.active .model-arrow {
  transform: rotate(180deg);
}
.model-chip.active {
  border-color: var(--border-accent);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}
.toolbar-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
  backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  padding: 6px;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(96, 165, 250, 0.06) inset;
  z-index: 100;
  animation: dropdownIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.dropdown-group {
  margin-bottom: 4px;
}
.dropdown-group:last-child {
  margin-bottom: 0;
}
.dropdown-group-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 5px 10px 3px;
}
.dropdown-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.dropdown-option:hover {
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  color: var(--text-primary);
}
.dropdown-option.active {
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font-weight: 600;
}
.dropdown-default {
  color: #fbbf24;
  display: flex;
  margin-right: 2px;
}
.model-icon {
  color: var(--text-tertiary);
  margin-right: 6px;
  opacity: 0.8;
}
.dropdown-option:hover .model-icon,
.dropdown-option.active .model-icon {
  opacity: 1;
  color: var(--accent-primary);
}
.model-text {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dropdown-empty {
  padding: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-quaternary);
}
</style>
