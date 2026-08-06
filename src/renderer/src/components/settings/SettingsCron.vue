<script setup lang="ts">
import { ref, onMounted, useTemplateRef, watch, nextTick } from 'vue'
import { cronApi, type CronTask, type CronTaskForm } from '@renderer/api/cron'
import {
  cronTaskLogApi,
  type CronTaskLog,
  type CronTaskLogPageQuery
} from '@renderer/api/cronTaskLog'
import Icon from '@renderer/components/common/Icon.vue'
import ConfirmDialog from '@renderer/components/common/ConfirmDialog.vue'
import { notifySuccess } from '@renderer/utils/feedback'

const tasks = ref<CronTask[]>([])
const loading = ref(false)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const form = ref<CronTaskForm>({ taskName: '', cronExpression: '', taskDescription: '' })
const submitting = ref(false)
const deleting = ref<number | null>(null)
const showDeleteConfirm = ref(false)
const taskToDelete = ref<CronTask | null>(null)
const taskNameInput = useTemplateRef<HTMLInputElement>('taskNameInput')

// 日志相关
const showLogs = ref(false)
const selectedTaskId = ref<number | null>(null)
const selectedTaskName = ref('')
const logLoading = ref(false)
const taskLogs = ref<CronTaskLog[]>([])
const logPage = ref(1)
const logPageSize = ref(10)
const logTotal = ref(0)

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

async function loadTasks(): Promise<void> {
  loading.value = true
  try {
    const res = await cronApi.list()
    if (res.code === 200) tasks.value = res.data || []
  } catch {
    tasks.value = []
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.value = { taskName: '', cronExpression: '', taskDescription: '' }
  showForm.value = true
}

function openEdit(t: CronTask): void {
  editingId.value = t.id
  form.value = {
    taskName: t.taskName,
    cronExpression: t.cronExpression,
    taskDescription: t.taskDescription || ''
  }
  showForm.value = true
}

function cancelForm(): void {
  showForm.value = false
}

async function saveForm(): Promise<void> {
  if (!form.value.taskName.trim() || !form.value.cronExpression.trim() || submitting.value) return

  submitting.value = true
  try {
    if (editingId.value) {
      await cronApi.update(editingId.value, { ...form.value })
      notifySuccess(`已更新定时任务「${form.value.taskName}」`)
    } else {
      await cronApi.create({ ...form.value })
      notifySuccess(`已创建定时任务「${form.value.taskName}」`)
    }
    showForm.value = false
    await loadTasks()
  } catch {
    // 已由拦截器统一提示
  } finally {
    submitting.value = false
  }
}

async function toggleTask(t: CronTask): Promise<void> {
  try {
    const newStatus = t.status ? 0 : 1
    await cronApi.updateStatus(t.id, newStatus)
    t.status = newStatus
    const statusText = newStatus ? '已启用' : '已禁用'
    notifySuccess(`${statusText}定时任务「${t.taskName}」`)
  } catch {
    // 已由拦截器统一提示
  }
}

function confirmDelete(t: CronTask): void {
  taskToDelete.value = t
  showDeleteConfirm.value = true
}

async function deleteTask(): Promise<void> {
  if (!taskToDelete.value || deleting.value === taskToDelete.value.id) return

  const taskId = taskToDelete.value.id
  deleting.value = taskId

  try {
    const taskName = taskToDelete.value.taskName
    await cronApi.remove(taskId)
    tasks.value = tasks.value.filter((x) => x.id !== taskId)
    showDeleteConfirm.value = false
    taskToDelete.value = null
    notifySuccess(`已删除定时任务「${taskName}」`)
  } catch {
    // 已由拦截器统一提示
  } finally {
    deleting.value = null
  }
}

function cancelDelete(): void {
  showDeleteConfirm.value = false
  taskToDelete.value = null
}

function formatTime(time?: string): string {
  if (!time) return '—'
  try {
    return new Date(time).toLocaleString()
  } catch {
    return '—'
  }
}

/** 查看任务日志 */
async function viewTaskLogs(task: CronTask): Promise<void> {
  selectedTaskId.value = task.id
  selectedTaskName.value = task.taskName
  logPage.value = 1
  await loadTaskLogs()
  showLogs.value = true
}

/** 加载任务日志 */
async function loadTaskLogs(): Promise<void> {
  if (!selectedTaskId.value) return

  logLoading.value = true
  try {
    const params: CronTaskLogPageQuery = {
      taskId: selectedTaskId.value,
      pageNum: logPage.value,
      pageSize: logPageSize.value
    }
    const res = await cronTaskLogApi.pageLogs(params)
    if (res.code === 200 && res.data) {
      taskLogs.value = res.data.records || []
      logTotal.value = res.data.total || 0
    } else {
      taskLogs.value = []
      logTotal.value = 0
    }
  } catch {
    taskLogs.value = []
    logTotal.value = 0
  } finally {
    logLoading.value = false
  }
}

/** 日志分页 */
function onLogPageChange(page: number): void {
  logPage.value = page
  loadTaskLogs()
}

/** 获取状态 */
function getStatusText(status: number): string {
  const types = ['执行中', '成功', '失败']
  return types[status] || '未知'
}

/** 获取状态样式 */
function getStatusClass(status: number): string {
  const types = ['running', 'success', 'failed']
  return types[status] || 'unknown'
}

/** 关闭日志弹窗 */
function closeTaskLogs(): void {
  showLogs.value = false
  taskLogs.value = []
  logPage.value = 1
  logTotal.value = 0
}

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

watch(showForm, async (newVal) => {
  if (newVal) {
    await nextTick()
    taskNameInput.value?.focus()
  }
})

onMounted(loadTasks)
</script>

<template>
  <div class="cron-container">
    <div class="cron-header">
      <span class="cron-label">
        <Icon name="clock" :size="12" />
        定时任务
      </span>
      <button class="action-btn sm" @click="openCreate">
        <Icon name="plus" :size="12" />
        <span>新建任务</span>
      </button>
    </div>

    <div class="cron-content">
      <div v-if="loading" class="state-box">
        <span>加载中...</span>
      </div>
      <div v-else-if="tasks.length === 0" class="state-box">
        <span style="font-size: 13px">暂无定时任务，点击"新建任务"创建一个</span>
      </div>
      <div v-else class="list">
        <div
          v-for="t in tasks"
          :key="t.id"
          class="list-item"
          :class="{ 'deleting-item': deleting === t.id }"
        >
          <div class="list-item-main">
            <div class="list-item-title">
              {{ t.taskName }}
              <span class="cron-badge">{{ t.cronExpression }}</span>
            </div>
            <div class="list-item-meta">
              {{ t.taskDescription || '无描述' }} ·
              <template v-if="t.nextExecTime">下次执行: {{ formatTime(t.nextExecTime) }}</template>
              <template v-else>最后执行: {{ formatTime(t.lastExecutedTime) }}</template>
            </div>
          </div>
          <button class="action-btn sm" @click="openEdit(t)">
            <Icon name="edit" :size="12" />
            <span>编辑</span>
          </button>
          <button class="action-btn sm" @click="viewTaskLogs(t)">
            <Icon name="file" :size="12" />
            <span>日志</span>
          </button>
          <button class="toggle-btn" :class="t.status ? 'on' : 'off'" @click="toggleTask(t)">
            {{ t.status ? '已启用' : '已禁用' }}
          </button>
          <button
            class="action-btn sm danger"
            :disabled="deleting === t.id"
            @click.stop="confirmDelete(t)"
          >
            <Icon name="trash" :size="12" />
            <span>删除</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 新建/编辑弹框 -->
    <div v-if="showForm" class="modal-inner-overlay">
      <div class="modal-inner-box">
        <h3>{{ editingId ? '编辑定时任务' : '新建定时任务' }}</h3>
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
            {{ submitting ? (editingId ? '更新中...' : '创建中...') : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 删除确认对话框 -->
  <ConfirmDialog
    v-if="showDeleteConfirm"
    title="删除定时任务"
    :message="`确定要删除任务「${taskToDelete?.taskName}」吗？此操作不可撤销。`"
    confirm-text="删除"
    cancel-text="取消"
    @confirm="deleteTask"
    @cancel="cancelDelete"
  />

  <!-- 任务日志弹窗 -->
  <div v-if="showLogs" class="modal-inner-overlay">
    <div class="modal-inner-box" style="max-width: 700px; min-height: 500px">
      <div class="logs-header">
        <h3>任务执行日志 - {{ selectedTaskName }}</h3>
        <button class="close-btn" @click="closeTaskLogs">
          <Icon name="x" :size="16" />
        </button>
      </div>

      <div class="logs-content">
        <div v-if="logLoading" class="logs-loading">
          <span>加载日志中...</span>
        </div>
        <div v-else-if="taskLogs.length === 0" class="logs-empty">
          <span>暂无执行日志</span>
        </div>
        <div v-else class="logs-list">
          <div v-for="log in taskLogs" :key="log.id" class="log-item">
            <div class="log-time">
              <div class="log-trigger-time">触发时间: {{ formatTime(log.triggeredTime) }}</div>
              <div v-if="log.finishedTime" class="log-finish-time">
                完成时间: {{ formatTime(log.finishedTime) }}
              </div>
            </div>
            <div class="log-status" :class="getStatusClass(log.status)">
              {{ getStatusText(log.status) }}
            </div>
            <div v-if="log.executionDuration" class="log-duration">
              耗时: {{ log.executionDuration }}秒
            </div>
            <div v-if="log.errorMessage" class="log-error">错误信息: {{ log.errorMessage }}</div>
            <div v-if="log.executionResult" class="log-result">
              执行结果: {{ log.executionResult }}
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="taskLogs.length > 0 && logTotal > logPageSize" class="logs-pagination">
        <div class="pagination-info">共 {{ logTotal }} 条记录</div>
        <div class="pagination-buttons">
          <button class="page-btn" :disabled="logPage === 1" @click="onLogPageChange(logPage - 1)">
            上一页
          </button>
          <span class="page-info">第 {{ logPage }} 页</span>
          <button
            class="page-btn"
            :disabled="logPage * logPageSize >= logTotal"
            @click="onLogPageChange(logPage + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cron-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.cron-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.cron-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cron-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
}
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 40px 20px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 4px 0;
}
.list-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}
.list-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.list-item.deleting-item {
  opacity: 0.6;
  transform: translateX(10px);
  background: color-mix(in srgb, var(--accent-error) 8%, transparent);
  border-color: color-mix(in srgb, var(--accent-error) 20%, transparent);
}
.list-item-main {
  flex: 1;
  min-width: 0;
}
.list-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.cron-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font-family: var(--font-code);
}
.list-item-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 3px;
}
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
.action-btn.sm {
  padding: 5px 12px;
  font-size: 12px;
}
.action-btn.danger {
  border-color: var(--border-color);
  color: var(--accent-error);
}
.action-btn.danger:hover:not(:disabled) {
  border-color: var(--accent-error);
  background: color-mix(in srgb, var(--accent-error) 8%, transparent);
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
.toggle-btn {
  font-size: 11px;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  border: 1px solid;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 500;
  flex-shrink: 0;
}
.toggle-btn.on {
  background: color-mix(in srgb, var(--accent-success) 12%, transparent);
  color: var(--accent-success);
  border-color: color-mix(in srgb, var(--accent-success) 30%, transparent);
}
.toggle-btn.off {
  background: color-mix(in srgb, var(--accent-error) 12%, transparent);
  color: var(--accent-error);
  border-color: color-mix(in srgb, var(--accent-error) 30%, transparent);
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
  animation: modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
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

/* 任务日志相关样式 */
.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-primary);
}

.logs-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.logs-content {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.logs-loading,
.logs-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
  color: var(--text-tertiary);
  font-size: 14px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item {
  padding: 12px;
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.log-time {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.log-status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  margin-bottom: 8px;
}

.log-status.running {
  background: color-mix(in srgb, var(--accent-warning) 20%, transparent);
  color: var(--accent-warning);
}

.log-status.success {
  background: color-mix(in srgb, var(--accent-success) 20%, transparent);
  color: var(--accent-success);
}

.log-status.failed {
  background: color-mix(in srgb, var(--accent-error) 20%, transparent);
  color: var(--accent-error);
}

.log-duration {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.log-error {
  font-size: 12px;
  color: var(--accent-error);
  background: color-mix(in srgb, var(--accent-error) 8%, transparent);
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.log-result {
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  padding: 8px;
  border-radius: 4px;
}

.logs-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-primary);
}

.pagination-info {
  font-size: 12px;
  color: var(--text-secondary);
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-secondary);
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 0 8px;
}

@keyframes modalIn {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
