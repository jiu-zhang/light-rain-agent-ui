<script setup lang="ts">
import type { IconName } from './Icon.vue'
import Icon from './Icon.vue'

interface Props {
  icon?: IconName
  title?: string
  description?: string
  actionLabel?: string
  actionIcon?: IconName
  compact?: boolean
}

withDefaults(defineProps<Props>(), {
  icon: 'box',
  title: '暂无数据',
  description: '当前没有内容',
  actionLabel: '',
  actionIcon: undefined,
  compact: false
})

const emit = defineEmits<{
  (e: 'action'): void
}>()

function handleAction(): void {
  emit('action')
}
</script>

<template>
  <div :class="['empty-container', { compact: compact }]">
    <div class="empty-content">
      <div class="empty-icon">
        <Icon :name="icon" :size="compact ? 20 : 32" class="icon" />
      </div>
      <div class="empty-info">
        <h3 class="empty-title">{{ title }}</h3>
        <p class="empty-desc">{{ description }}</p>
      </div>
      <button v-if="actionLabel" class="empty-action" @click="handleAction">
        <Icon v-if="actionIcon" :name="actionIcon" :size="14" />
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  padding: 2rem;
  text-align: center;
  background: var(--bg-primary);
}

.empty-container.compact {
  min-height: 100px;
  padding: 1rem;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 300px;
}

.empty-icon {
  width: 86px;
  height: 86px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(147, 51, 234, 0.08));
  border: 2px solid rgba(59, 130, 246, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.empty-container:hover .empty-icon {
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
}

.icon {
  filter: grayscale(0.3);
}

.empty-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.empty-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.empty-action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.empty-action:hover {
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}

.empty-action:active {
  transform: translateY(0);
}

.compact .empty-content {
  gap: 12px;
}

.compact .empty-icon {
  width: 48px;
  height: 48px;
}

.compact .empty-title {
  font-size: 14px;
}

.compact .empty-desc {
  font-size: 12px;
}

.compact .empty-action {
  padding: 6px 12px;
  font-size: 12px;
}
</style>
