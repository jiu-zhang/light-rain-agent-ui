<script setup lang="ts">
import { ref, watch } from 'vue'
import Icon from '@renderer/components/common/Icon.vue'
import type { ToolRun, PlanStepDisplay } from '@renderer/stores/chat'

const props = defineProps<{
  open: boolean
  planSteps: PlanStepDisplay[]
  toolRuns: ToolRun[]
  isPlanRunning: boolean
  planGoal: string
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  viewHistory: []
}>()

/** 折叠的工具参数（显示/隐藏） */
const expandedTools = ref<Set<string>>(new Set())

function toggleTool(id: string): void {
  const next = new Set(expandedTools.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedTools.value = next
}

/** 工具调用 icon */
function toolIcon(name: string): string {
  if (name.startsWith('read') || name.startsWith('list') || name.startsWith('glob') || name.startsWith('grep')) return 'folder'
  if (name.startsWith('write') || name.startsWith('edit') || name.startsWith('delete')) return 'edit'
  if (name.startsWith('shell')) return 'terminal'
  if (name.startsWith('http') || name === 'url_fetch') return 'globe'
  if (name.startsWith('json')) return 'braces'
  if (name.startsWith('todo') || name.startsWith('cron')) return 'clock'
  if (name === 'subplan_execute') return 'git-branch'
  return 'wrench'
}

function statusText(status: string): string {
  return status === 'RUNNING' ? '执行中' : status === 'SUCCESS' ? '成功' : '失败'
}

function shortResult(text?: string): string {
  if (!text) return ''
  const flat = text.replace(/\n/g, ' ')
  return flat.length > 120 ? flat.slice(0, 120) + '…' : flat
}

/** 加载中但暂无工具/计划：显示等待态 */
const showWaiting = ref(false)
watch(
  () => props.loading,
  (v) => {
    showWaiting.value = v && props.toolRuns.length === 0 && props.planSteps.length === 0
  },
  { immediate: true }
)
</script>

<template>
  <aside class="exec-panel" :class="{ open }">
    <div class="exec-header">
      <div class="exec-title">
        <Icon name="activity" :size="16" class="exec-title-icon" />
        <span>执行面板</span>
      </div>
      <div class="exec-actions">
        <button class="exec-action" title="查看历史执行记录" @click="emit('viewHistory')">
          <Icon name="history" :size="15" />
        </button>
        <button class="exec-action" title="收起面板" @click="emit('close')">
          <Icon name="x" :size="15" />
        </button>
      </div>
    </div>

    <div class="exec-body">
      <!-- 计划进度 -->
      <section v-if="planSteps.length || isPlanRunning" class="exec-section">
        <div class="exec-section-title">
          <Icon name="git-branch" :size="14" />
          <span>计划进度</span>
          <span v-if="isPlanRunning" class="live-dot" />
        </div>
        <div v-if="planGoal" class="plan-goal">{{ planGoal }}</div>
        <ol class="plan-steps">
          <li
            v-for="s in planSteps"
            :key="s.index"
            class="plan-step"
            :class="s.status.toLowerCase()"
          >
            <span class="step-index">{{ s.index }}</span>
            <div class="step-main">
              <div class="step-name">
                {{ s.name }}
                <span v-if="s.error" class="step-error" :title="s.error">失败</span>
              </div>
            </div>
            <Icon v-if="s.status === 'RUNNING'" name="loader" :size="13" class="step-spin" />
            <Icon
              v-else-if="s.status === 'COMPLETED'"
              name="check"
              :size="13"
              class="step-done"
            />
            <Icon v-else name="x" :size="13" class="step-fail" />
          </li>
        </ol>
      </section>

      <!-- 工具调用 -->
      <section v-if="toolRuns.length || showWaiting" class="exec-section">
        <div class="exec-section-title">
          <Icon name="wrench" :size="14" />
          <span>工具调用</span>
          <span v-if="loading" class="live-dot" />
        </div>

        <div v-if="toolRuns.length === 0" class="exec-empty">等待 Agent 调用工具…</div>

        <div class="tool-list">
          <div
            v-for="t in toolRuns"
            :key="t.id"
            class="tool-item"
            :class="t.status.toLowerCase()"
          >
            <div class="tool-item-head">
              <Icon :name="toolIcon(t.toolName) as any" :size="14" class="tool-item-icon" />
              <span class="tool-item-name">{{ t.toolName }}</span>
              <span class="tool-item-status">{{ statusText(t.status) }}</span>
              <button
                v-if="t.arguments"
                class="tool-expand"
                @click="toggleTool(t.id)"
              >
                <Icon name="chevron-down" :size="13" :class="{ rotated: expandedTools.has(t.id) }" />
              </button>
            </div>
            <div v-if="expandedTools.has(t.id) && t.arguments" class="tool-args">
              <pre>{{ t.arguments }}</pre>
            </div>
            <div v-if="t.result" class="tool-result" :class="{ open: expandedTools.has(t.id) }">
              {{ shortResult(t.result) }}
            </div>
          </div>
        </div>
      </section>

      <!-- 空态 -->
      <div v-if="!loading && toolRuns.length === 0 && planSteps.length === 0" class="exec-empty-page">
        <Icon name="activity" :size="28" class="exec-empty-icon" />
        <p>执行面板会实时展示计划的<br />步骤进度与工具调用过程</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.exec-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  transform: translateX(100%);
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 30;
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.15);
}
[data-theme='light'] .exec-panel {
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.06);
}
.exec-panel.open {
  transform: translateX(0);
}

.exec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.exec-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.exec-title-icon {
  color: var(--accent-primary);
}
.exec-actions {
  display: flex;
  gap: 4px;
}
.exec-action {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.exec-action:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.exec-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.exec-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.exec-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.exec-section-title svg {
  color: var(--accent-primary);
}
.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-success);
  animation: livePulse 1.2s ease-in-out infinite;
}
@keyframes livePulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 0 5px rgba(34, 197, 94, 0);
  }
}

.plan-goal {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  padding: 8px 10px;
  background: var(--bg-glass);
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  word-break: break-all;
}

.plan-steps {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.plan-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}
.plan-step.completed {
  border-color: color-mix(in srgb, var(--accent-success) 25%, var(--border-color));
}
.plan-step.failed {
  border-color: color-mix(in srgb, var(--accent-error) 30%, var(--border-color));
}
.step-index {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}
.plan-step.running .step-index {
  background: color-mix(in srgb, var(--accent-primary) 15%, transparent);
  color: var(--accent-primary);
}
.step-main {
  flex: 1;
  min-width: 0;
}
.step-name {
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.step-error {
  margin-left: 6px;
  font-size: 10px;
  color: var(--accent-error);
}
.step-spin {
  color: var(--accent-primary);
  animation: spin 0.9s linear infinite;
}
.step-done {
  color: var(--accent-success);
}
.step-fail {
  color: var(--accent-error);
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tool-item {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}
.tool-item.failed {
  border-color: color-mix(in srgb, var(--accent-error) 30%, var(--border-color));
}
.tool-item-head {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
}
.tool-item-icon {
  color: var(--accent-info);
  flex-shrink: 0;
}
.tool-item.failed .tool-item-icon {
  color: var(--accent-error);
}
.tool-item-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-code);
}
.tool-item-status {
  font-size: 10px;
  color: var(--text-quaternary);
  flex-shrink: 0;
}
.tool-item.running .tool-item-status {
  color: var(--accent-warning);
}
.tool-item.success .tool-item-status {
  color: var(--accent-success);
}
.tool-expand {
  border: none;
  background: transparent;
  color: var(--text-quaternary);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
}
.tool-expand svg {
  transition: transform 0.2s ease;
}
.tool-expand svg.rotated {
  transform: rotate(180deg);
}
.tool-args {
  padding: 0 10px 8px;
}
.tool-args pre {
  margin: 0;
  padding: 8px 10px;
  font-size: 11px;
  font-family: var(--font-code);
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  color: var(--text-secondary);
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.tool-result {
  padding: 0 10px 8px;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tool-result.open {
  display: block;
  -webkit-line-clamp: unset;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.exec-empty {
  font-size: 12px;
  color: var(--text-quaternary);
  padding: 4px 2px;
}
.exec-empty-page {
  margin: auto 0;
  text-align: center;
  color: var(--text-quaternary);
  font-size: 12px;
  line-height: 1.7;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.exec-empty-icon {
  color: var(--border-strong);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
