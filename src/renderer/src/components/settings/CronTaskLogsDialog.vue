<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  cronTaskLogApi,
  type CronTaskLog,
  type CronTaskLogPageQuery
} from '@renderer/api/cronTaskLog'
import Icon from '@renderer/components/common/Icon.vue'

const props = defineProps<{
  show: boolean
  taskId: number | null
  taskName: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const logLoading = ref(false)
const taskLogs = ref<CronTaskLog[]>([])
const logPage = ref(1)
const logPageSize = ref(10)
const logTotal = ref(0)

function formatTime(time?: string): string {
  if (!time) return '—'
  try {
    return new Date(time).toLocaleString()
  } catch {
    return '—'
  }
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

/** 加载任务日志 */
async function loadTaskLogs(): Promise<void> {
  if (!props.taskId) return

  logLoading.value = true
  try {
    const params: CronTaskLogPageQuery = {
      taskId: props.taskId,
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
  void loadTaskLogs()
}

/** 关闭日志弹窗 */
function closeTaskLogs(): void {
  emit('update:show', false)
  taskLogs.value = []
  logPage.value = 1
  logTotal.value = 0
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      logPage.value = 1
      void loadTaskLogs()
    }
  }
)
</script>

<template>
  <div v-if="show" class="modal-inner-overlay">
    <div class="modal-inner-box">
      <div class="logs-header">
        <h3>任务执行日志 - {{ taskName }}</h3>
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
