<script setup lang="ts">
import { computed } from 'vue'
import type { IconName } from './Icon.vue'

const statusConfig = {
  success: { color: '#22c55e', icon: 'check', label: '成功' },
  error: { color: '#ef4444', icon: 'x', label: '错误' },
  warning: { color: '#f59e0b', icon: 'alert-triangle', label: '警告' },
  info: { color: '#3b82f6', icon: 'info', label: '信息' },
  processing: { color: '#60a5fa', icon: 'loader', label: '处理中' }
}

type Status = keyof typeof statusConfig

const props = defineProps<{
  type?: Status
  label?: string
  icon?: IconName
  size?: 'sm' | 'md'
}>()

const config = computed(() => {
  if (props.type && statusConfig[props.type]) {
    return {
      ...statusConfig[props.type],
      label: props.label || statusConfig[props.type].label
    }
  }
  
  return {
    color: '#6b7280',
    icon: props.icon || 'info',
    label: props.label || '未知'
  }
})

const typeClasses = 'status-badge' + 
  (props.size === 'sm' ? ' sm' : '') + 
  (props.type ? ` ${props.type}` : '')
</script>

<template>
  <span :class="typeClasses">
    <Icon 
      :name="config.icon as IconName" 
      :size="props.size === 'sm' ? 10 : 12"
      :class="config.icon === 'loader' ? 'spin' : ''"
    />
    <span class="badge-label">{{ config.label }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: v-bind("config.color");
  transition: all 0.2s ease;
}

.status-badge.sm {
  padding: 1px 6px;
  font-size: 10px;
  gap: 3px;
}

.badge-label {
  white-space: nowrap;
}

.status-badge.success {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}

.status-badge.error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.status-badge.warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.status-badge.info {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.status-badge.processing {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
}
</style>
