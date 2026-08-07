<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@renderer/components/common/Icon.vue'
import type { ToolRun } from '@renderer/stores/chat'

interface Props {
  tool: ToolRun
  compact?: boolean
}

const props = defineProps<Props>()
const isExpanded = ref(true)

const statusIcon = computed(() => {
  switch (props.tool.status) {
    case 'RUNNING':
      return 'loader'
    case 'SUCCESS':
      return 'check'
    case 'FAILED':
      return 'x'
    default:
      return 'info'
  }
})

const statusColor = computed(() => {
  switch (props.tool.status) {
    case 'RUNNING':
      return 'var(--accent-primary)'
    case 'SUCCESS':
      return 'var(--accent-success)'
    case 'FAILED':
      return 'var(--accent-error)'
    default:
      return 'var(--text-secondary)'
  }
})

const formattedDuration = computed(() => {
  if (typeof props.tool.durationMs !== 'number') return ''
  return props.tool.durationMs < 1000
    ? `${props.tool.durationMs}ms`
    : `${(props.tool.durationMs / 1000).toFixed(1)}s`
})

const parsedArgs = computed(() => {
  if (!props.tool.arguments) return null
  try {
    return JSON.parse(props.tool.arguments)
  } catch {
    return props.tool.arguments
  }
})
</script>

<template>
  <div class="tool-execution-detail" :class="{ compact }">
    <button class="tool-header" @click="isExpanded = !isExpanded">
      <div class="tool-status">
        <Icon
          :name="statusIcon"
          :size="compact ? 12 : 14"
          class="status-icon"
          :style="{ color: statusColor }"
        />
        <span class="tool-name">{{ tool.toolName }}</span>
      </div>

      <div class="tool-meta">
        <span v-if="tool.status === 'RUNNING'" class="tool-spinner" />
        <span v-if="formattedDuration" class="tool-duration">{{ formattedDuration }}</span>
        <Icon name="chevron-down" :size="12" class="tool-arrow" :class="{ expanded: isExpanded }" />
      </div>
    </button>

    <div v-if="isExpanded" class="tool-content">
      <div v-if="tool.arguments" class="tool-section">
        <span class="section-label">参数:</span>
        <pre class="tool-args">{{ parsedArgs }}</pre>
      </div>

      <div v-if="tool.result" class="tool-section">
        <span class="section-label">结果:</span>
        <div class="tool-result">{{ tool.result }}</div>
      </div>

      <div v-if="tool.status === 'RUNNING'" class="tool-progress">
        <Icon name="loader" :size="14" class="spin" />
        <span>工具执行中...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-execution-detail {
  margin-bottom: 8px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.tool-execution-detail.compact {
  border-radius: 8px;
  margin-bottom: 6px;
}

.tool-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s;
}

.tool-header:hover {
  background: rgba(96, 165, 250, 0.05);
}

.tool-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  animation: var(--animation-fade-in);
}

.tool-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.tool-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top: 2px solid var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.tool-duration {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-code);
}

.tool-arrow {
  color: var(--text-tertiary);
  transition: transform 0.2s;
}

.tool-arrow.expanded {
  transform: rotate(180deg);
}

.tool-content {
  border-top: 1px solid var(--border-color);
  padding: 12px;
  background: var(--bg-tertiary);
}

.tool-section {
  margin-bottom: 8px;
}

.tool-section:last-child {
  margin-bottom: 0;
}

.section-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tool-args {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px;
  font-size: 11px;
  font-family: var(--font-code);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.tool-result {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 150px;
  overflow-y: auto;
}

.tool-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-primary);
  font-size: 12px;
  font-weight: 500;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
