<script setup lang="ts">
import { ref, watch, nextTick, useTemplateRef } from 'vue'
import { cronApi, type CronTask, type CronTaskForm } from '@renderer/api/cron'
import { notifySuccess } from '@renderer/utils/feedback'

const props = defineProps<{
  show: boolean
  editing: CronTask | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
}>()

const form = ref<CronTaskForm>({ taskName: '', cronExpression: '', taskDescription: '' })
const submitting = ref(false)
const taskNameInput = useTemplateRef<HTMLInputElement>('taskNameInput')

// Spring Quartz cron表达式是6位格式：秒 分 时 日 月 周
const CRON_HINTS = [
  { expression: '0 0 9 * * *', description: '每天上午9点' },
  { expression: '0 0 0 * * 0', description: '每周日午夜' },
  { expression: '0 0 8,20 * * *', description: '每天上午8点和晚上8点' },
  { expression: '0 0 0 1 * *', description: '每月1号午夜' },
  { expression: '0 0,15,30,45 * * * *', description: '每15分钟' },
  { expression: '0 0 0,2,4,6,8,10,12,14,16,18,20,22 * * *', description: '每2小时' },
  { expression: '0 30 14 * * 1-5', description: '工作日(周一到周五)下午2:30' },
  { expression: '0 0 12 * * *', description: '每天中午12点' },
  { expression: '0 0 0 L * *', description: '每月最后一天午夜' },
  { expression: '0 30 8 * * 1', description: '每周一上午8:30' }
]

function getCronDescription(expression: string): string {
  if (!expression.trim()) return ''

  // 简单的cron表达式解析 (6位：秒 分 时 日 月 周)
  const parts = expression.trim().split(/\s+/)

  if (parts.length < 6) return '表达式格式错误'

  const [, minute, hour, day, , weekday] = parts

  // 常见的cron表达式匹配 (6位：秒 分 时 日 月 周)
  const patterns = [
    { match: '0 0 9 * * *', desc: '每天上午9点' },
    { match: '0 0 0 * * 0', desc: '每周日午夜' },
    { match: '0 0 8,20 * * *', desc: '每天上午8点和晚上8点' },
    { match: '0 0 0 1 * *', desc: '每月1号午夜' },
    { match: '0 0,15,30,45 * * * *', desc: '每15分钟' },
    { match: '0 0 0,2,4,6,8,10,12,14,16,18,20,22 * * *', desc: '每2小时' },
    { match: '0 30 14 * * 1-5', desc: '工作日(周一到周五)下午2:30' },
    { match: '0 0 12 * * *', desc: '每天中午12点' },
    { match: '0 0 0 L * *', desc: '每月最后一天午夜' },
    { match: '0 30 8 * * 1', desc: '每周一上午8:30' }
  ]

  // 精确匹配
  for (const pattern of patterns) {
    if (expression.trim() === pattern.match) {
      return pattern.desc
    }
  }

  // 简单解析
  let desc = ''

  if (minute.startsWith('*/')) {
    const interval = minute.slice(2)
    desc += `每${interval}分钟`
  } else if (minute === '0') {
    if (hour === '*') {
      desc += '每小时整点'
    } else if (hour.startsWith('*/')) {
      const interval = hour.slice(2)
      desc += `每${interval}小时`
    } else if (hour !== '*') {
      desc += `${hour}点整`
    }
  }

  if (weekday !== '*') {
    if (weekday === '1-5') desc += '，工作日'
    else if (weekday === '0' || weekday === '7') desc += '，周日'
    else if (weekday === '1') desc += '，周一'
  }

  if (day !== '*') {
    if (day === '1') desc += '，每月1号'
    else desc += `，每月${day}号`
  }

  if (desc === '') desc = '自定义执行时间'

  return desc || '复杂执行计划'
}

watch(
  () => props.show,
  async (newVal) => {
    if (!newVal) return
    form.value = props.editing
      ? {
          taskName: props.editing.taskName,
          cronExpression: props.editing.cronExpression,
          taskDescription: props.editing.taskDescription || ''
        }
      : { taskName: '', cronExpression: '', taskDescription: '' }
    await nextTick()
    taskNameInput.value?.focus()
  }
)

function cancelForm(): void {
  emit('update:show', false)
}

async function saveForm(): Promise<void> {
  if (!form.value.taskName.trim() || !form.value.cronExpression.trim() || submitting.value) return

  submitting.value = true
  try {
    if (props.editing) {
      await cronApi.update(props.editing.id, { ...form.value })
      notifySuccess(`已更新定时任务「${form.value.taskName}」`)
    } else {
      await cronApi.create({ ...form.value })
      notifySuccess(`已创建定时任务「${form.value.taskName}」`)
    }
    emit('saved')
    emit('update:show', false)
  } catch {
    // 已由拦截器统一提示
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="show" class="modal-inner-overlay">
    <div class="modal-inner-box">
      <h3>{{ editing ? '编辑定时任务' : '新建定时任务' }}</h3>
      <div class="form-row">
        <label>任务名称</label>
        <input ref="taskNameInput" v-model="form.taskName" placeholder="如：每日 9 点工作总结" />
      </div>
      <div class="form-row">
        <label>cron 表达式</label>
        <input v-model="form.cronExpression" placeholder="如 0 9 * * *" />
        <div
          v-if="
            form.cronExpression.trim() && getCronDescription(form.cronExpression).includes('错误')
          "
          class="cron-error"
        >
          ⚠️ {{ getCronDescription(form.cronExpression) }}
        </div>
        <div v-else-if="form.cronExpression.trim()" class="cron-explanation">
          💡 {{ getCronDescription(form.cronExpression) }}
        </div>
        <div class="cron-hints">
          <span
            v-for="hint in CRON_HINTS"
            :key="hint.expression"
            class="cron-hint"
            :title="hint.description"
            @click="form.cronExpression = hint.expression"
          >
            <span class="hint-expression">{{ hint.expression }}</span>
            <span class="hint-description">{{ hint.description }}</span>
          </span>
        </div>
      </div>
      <div class="form-row">
        <label>任务描述/执行内容</label>
        <textarea
          v-model="form.taskDescription"
          rows="3"
          placeholder="告诉 Agent 这个任务要做什么"
          class="form-textarea"
        ></textarea>
      </div>
      <div class="form-actions">
        <button class="action-btn" @click="cancelForm">取消</button>
        <button
          class="action-btn primary"
          :disabled="!form.taskName.trim() || !form.cronExpression.trim() || submitting"
          @click="saveForm"
        >
          <span v-if="submitting" class="loading-spinner"></span>
          {{ submitting ? (editing ? '更新中...' : '创建中...') : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.action-btn:hover:not(:disabled) {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: var(--bg-hover);
}
.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.action-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

/* 加载动画 */
.loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
  margin-right: 6px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.modal-inner-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(2px);
}
.modal-inner-box {
  width: 400px;
  max-width: 90vw;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-xl);
  opacity: 0;
  transform: translateY(10px) scale(0.98);
  animation: modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.modal-inner-box h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 18px;
}
.form-row {
  margin-bottom: 14px;
}
.form-row label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}
.form-row input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}
.form-row input:focus {
  outline: none;
}
.form-textarea {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  resize: vertical;
  box-sizing: border-box;
  font-family: inherit;
}
.cron-hints {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.cron-hint {
  display: flex;
  flex-direction: column;
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--bg-quaternary);
  color: var(--text-tertiary);
  cursor: pointer;
  font-family: var(--font-code);
  transition: all 0.15s ease;
  border: 1px solid transparent;
  min-width: 80px;
  text-align: center;
}
.cron-hint:hover {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}
.hint-expression {
  font-weight: 600;
  font-family: var(--font-code);
  font-size: 10px;
  line-height: 1;
}
.hint-description {
  font-size: 9px;
  color: var(--text-quaternary);
  margin-top: 2px;
  line-height: 1.1;
  font-family: var(--font-sans);
}
.cron-error {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--accent-error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-error) 30%, transparent);
  border-radius: 6px;
  color: var(--accent-error);
  font-size: 11px;
  line-height: 1.4;
}
.cron-explanation {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
@keyframes overlayIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes modalIn {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
