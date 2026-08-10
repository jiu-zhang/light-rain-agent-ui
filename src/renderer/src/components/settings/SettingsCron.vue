<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { cronApi, type CronTask } from '@renderer/api/cron'
import Icon from '@renderer/components/common/Icon.vue'
import ConfirmDialog from '@renderer/components/common/ConfirmDialog.vue'
import CronTaskFormDialog from '@renderer/components/settings/CronTaskFormDialog.vue'
import CronTaskLogsDialog from '@renderer/components/settings/CronTaskLogsDialog.vue'
import { notifySuccess } from '@renderer/utils/feedback'

const tasks = ref<CronTask[]>([])
const loading = ref(false)
const showForm = ref(false)
const editingTask = ref<CronTask | null>(null)
const deleting = ref<number | null>(null)
const showDeleteConfirm = ref(false)
const taskToDelete = ref<CronTask | null>(null)

// 日志相关
const showLogs = ref(false)
const selectedTask = ref<CronTask | null>(null)

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
  editingTask.value = null
  showForm.value = true
}

function openEdit(t: CronTask): void {
  editingTask.value = t
  showForm.value = true
}

function onFormSaved(): void {
  void loadTasks()
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
function viewTaskLogs(task: CronTask): void {
  selectedTask.value = task
  showLogs.value = true
}

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
    <CronTaskFormDialog
      :show="showForm"
      :editing="editingTask"
      @update:show="showForm = $event"
      @saved="onFormSaved"
    />
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
  <CronTaskLogsDialog
    :show="showLogs"
    :task-id="selectedTask?.id ?? null"
    :task-name="selectedTask?.taskName ?? ''"
    @update:show="showLogs = $event"
  />
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
</style>
