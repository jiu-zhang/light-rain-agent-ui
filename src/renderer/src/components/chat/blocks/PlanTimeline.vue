<script setup lang="ts">
import Icon from '@renderer/components/common/Icon.vue'

interface PlanStepView {
  index: number
  name: string
  status: string
  error?: string
}

interface PlanView {
  goal: string
  total: number
  completed: number
  percent: number
  steps: PlanStepView[]
}

defineProps<{
  /** 聚合后的计划时间线视图数据 */
  planView: PlanView
  /** 计划是否仍在执行中（存在运行中的步骤） */
  active: boolean
}>()

/** 获取计划状态文本 */
function getStatusText(status: string): string {
  switch (status) {
    case 'RUNNING':
      return '执行中'
    case 'COMPLETED':
      return '已完成'
    case 'CANCELLED':
      return '已取消'
    case 'FAILED':
      return '失败'
    default:
      return status
  }
}
</script>

<template>
  <div class="plan-timeline">
    <div class="plan-timeline-header">
      <span class="ptl-ic"><Icon name="git-branch" :size="13" /></span>
      <span class="ptl-title">计划执行</span>
      <span class="ptl-count">{{ planView.completed }}/{{ planView.total }}</span>
      <span v-if="active" class="ptl-live" />
    </div>
    <div v-if="planView.goal" class="ptl-goal">{{ planView.goal }}</div>
    <div class="ptl-progress">
      <div class="ptl-progress-bar" :style="{ width: planView.percent + '%' }" />
    </div>
    <ol class="ptl-steps">
      <li
        v-for="s in planView.steps"
        :key="s.index"
        class="ptl-step"
        :class="s.status.toLowerCase()"
      >
        <span class="ptl-node">
          <Icon v-if="s.status === 'COMPLETED'" name="check" :size="12" />
          <Icon v-else-if="s.status === 'RUNNING'" name="loader" :size="12" class="ptl-spin" />
          <Icon v-else-if="s.status === 'FAILED'" name="x" :size="12" />
          <template v-else>{{ s.index }}</template>
        </span>
        <div class="ptl-main">
          <span class="ptl-name">{{ s.name }}</span>
          <span v-if="s.error" class="ptl-error" :title="s.error">{{ s.error }}</span>
        </div>
        <span v-if="s.status === 'RUNNING'" class="ptl-tag running">执行中</span>
        <span v-else-if="s.status === 'COMPLETED'" class="ptl-tag done">已完成</span>
        <span v-else-if="s.status === 'FAILED'" class="ptl-tag failed">失败</span>
        <span v-else class="ptl-tag">{{ getStatusText(s.status) }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.plan-timeline {
  margin-bottom: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.05), transparent);
}

.plan-timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ptl-ic {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.16), rgba(56, 189, 248, 0.14));
  color: #60a5fa;
}

.ptl-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.ptl-count {
  font-size: 11px;
  font-family: var(--font-code);
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 1px 8px;
  border-radius: 999px;
}

.ptl-live {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #60a5fa;
  animation: livePulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes livePulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.4);
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 0 5px rgba(96, 165, 250, 0);
  }
}

.ptl-goal {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  padding: 6px 10px;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.12);
  border-radius: 8px;
  margin-bottom: 10px;
  word-break: break-all;
}

.ptl-progress {
  height: 4px;
  border-radius: 999px;
  background: var(--bg-tertiary);
  overflow: hidden;
  margin-bottom: 10px;
}

.ptl-progress-bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #60a5fa, #34d399);
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.ptl-steps {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ptl-step {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-bottom: 14px;
}

.ptl-step:last-child {
  padding-bottom: 0;
}

.ptl-step::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 24px;
  bottom: 0;
  width: 2px;
  border-radius: 999px;
  background: var(--border-color);
  transition: background 0.3s ease;
}

.ptl-step:last-child::before {
  display: none;
}

.ptl-step.completed::before {
  background: rgba(34, 197, 94, 0.4);
}

.ptl-node {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-code);
  transition: all 0.25s ease;
}

.ptl-step.running .ptl-node {
  background: rgba(59, 130, 246, 0.14);
  color: #60a5fa;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.ptl-step.completed .ptl-node {
  background: rgba(34, 197, 94, 0.14);
  color: #22c55e;
}

.ptl-step.failed .ptl-node {
  background: rgba(239, 68, 68, 0.14);
  color: #ef4444;
}

.ptl-spin {
  animation: spin 0.9s linear infinite;
}

.ptl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 3px;
}

.ptl-name {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
}

.ptl-step.completed .ptl-name {
  color: var(--text-tertiary);
}

.ptl-error {
  font-size: 11px;
  color: #ef4444;
  line-height: 1.4;
  word-break: break-all;
}

.ptl-tag {
  font-size: 10px;
  flex-shrink: 0;
  margin-top: 2px;
  padding: 1px 8px;
  border-radius: 999px;
  font-weight: 500;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
}

.ptl-tag.running {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
}

.ptl-tag.done {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.ptl-tag.failed {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
