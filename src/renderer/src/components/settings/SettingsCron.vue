<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { cronApi, type CronTask, type CronTaskForm } from '@renderer/api/cron'
import Icon from '@renderer/components/common/Icon.vue'

const tasks = ref<CronTask[]>([])
const loading = ref(false)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const form = ref<CronTaskForm>({ taskName: '', cronExpression: '', taskDescription: '' })

const CRON_HINTS = ['0 9 * * *', '0 */30 * * * *', '0 0 12 * * ?']

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
  if (!form.value.taskName.trim() || !form.value.cronExpression.trim()) return
  try {
    if (editingId.value) {
      await cronApi.update(editingId.value, { ...form.value })
    } else {
      await cronApi.create({ ...form.value })
    }
    showForm.value = false
    await loadTasks()
  } catch {
    // 已由拦截器统一提示
  }
}

async function toggleTask(t: CronTask): Promise<void> {
  try {
    await cronApi.updateStatus(t.id, t.status ? 0 : 1)
    t.status = t.status ? 0 : 1
  } catch {
    // 已由拦截器统一提示
  }
}

async function deleteTask(t: CronTask): Promise<void> {
  try {
    await cronApi.remove(t.id)
    tasks.value = tasks.value.filter((x) => x.id !== t.id)
  } catch {
    // 已由拦截器统一提示
  }
}

function formatTime(time?: string): string {
  if (!time) return '—'
  try {
    return new Date(time).toLocaleString()
  } catch {
    return '—'
  }
}

onMounted(loadTasks)
</script>

<template>
  <div class="section-block">
    <div class="section-head">
      <span class="section-label">
        <Icon name="clock" :size="12" />
        定时任务
      </span>
      <button class="action-btn sm" @click="openCreate">
        <Icon name="plus" :size="12" />
        <span>新建任务</span>
      </button>
    </div>

    <div v-if="loading" class="state-box" style="height: auto; padding: 20px">
      <span>加载中...</span>
    </div>
    <div v-else-if="tasks.length === 0" class="state-box" style="height: auto; padding: 20px">
      <span style="font-size: 13px">暂无定时任务，点击"新建任务"创建一个</span>
    </div>
    <div v-else class="list">
      <div v-for="t in tasks" :key="t.id" class="list-item">
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
        <button class="toggle-btn" :class="t.status ? 'on' : 'off'" @click="toggleTask(t)">
          {{ t.status ? '已启用' : '已禁用' }}
        </button>
        <button class="action-btn sm danger" @click="deleteTask(t)">
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
        <input v-model="form.taskName" placeholder="如：每日 9 点工作总结" />
      </div>
      <div class="form-row">
        <label>cron 表达式</label>
        <input v-model="form.cronExpression" placeholder="如 0 9 * * *" />
        <div class="cron-hints">
          <span
            v-for="h in CRON_HINTS"
            :key="h"
            class="cron-hint"
            @click="form.cronExpression = h"
            >{{ h }}</span
          >
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
          :disabled="!form.taskName.trim() || !form.cronExpression.trim()"
          @click="saveForm"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-block {
  margin-bottom: 32px;
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
  animation: overlayIn 0.15s ease;
}
.modal-inner-box {
  width: 400px;
  max-width: 90vw;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-xl);
  animation: modalIn 0.2s ease;
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
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.cron-hint {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--bg-quaternary);
  color: var(--text-tertiary);
  cursor: pointer;
  font-family: var(--font-code);
  transition: all 0.15s ease;
}
.cron-hint:hover {
  color: var(--accent-primary);
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
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
