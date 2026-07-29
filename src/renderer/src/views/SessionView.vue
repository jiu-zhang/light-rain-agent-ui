<script setup lang="ts">
/**
 * 会话历史页面 - 科技感设计
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { chatApi } from '@renderer/api'
import { useChatStore } from '@renderer/stores'
import { formatRelativeTime } from '@renderer/utils'
import type { Session } from '@renderer/types'
import ConfirmDialog from '@renderer/components/common/ConfirmDialog.vue'

const router = useRouter()
const chatStore = useChatStore()

const sessions = ref<Session[]>([])
const loading = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref<string | null>(null)

async function loadSessions(): Promise<void> {
  loading.value = true
  try {
    const res = await chatApi.listSessions()
    if (res.code === 200 && res.data?.length) {
      sessions.value = res.data
    }
  } catch (e) {
    console.warn('加载会话列表失败:', e)
  } finally {
    loading.value = false
  }
}

async function openSession(sessionId: string): Promise<void> {
  await chatStore.switchSession(sessionId)
  router.push('/chat')
}

async function deleteSession(sessionId: string): Promise<void> {
  pendingDeleteId.value = sessionId
  showDeleteConfirm.value = true
}

async function confirmDeleteSession(): Promise<void> {
  const id = pendingDeleteId.value
  if (!id) return
  try {
    await chatApi.deleteSession(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
  } catch (e) {
    console.error('删除会话失败:', e)
  } finally {
    showDeleteConfirm.value = false
    pendingDeleteId.value = null
  }
}

function cancelDeleteSession(): void {
  showDeleteConfirm.value = false
  pendingDeleteId.value = null
}

onMounted(() => loadSessions())
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <div class="header-content">
        <h1 class="view-title">📋 会话历史</h1>
        <p class="view-desc">查看和管理历史会话</p>
      </div>
      <button class="action-btn" @click="loadSessions">
        <span class="btn-icon">🔄</span>
        <span>刷新</span>
      </button>
    </div>

    <div class="content-area">
      <div v-if="loading" class="loading-state">
        <div class="loader"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="sessions.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">暂无会话</div>
        <div class="empty-hint">开始一段新对话吧</div>
      </div>

      <div v-else class="session-list">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          @click="openSession(session.id)"
        >
          <div class="session-glow"></div>
          <div class="session-content">
            <div class="session-header">
              <span class="session-title">{{ session.title || '新对话' }}</span>
              <button class="delete-btn" title="删除" @click.stop="deleteSession(session.id)">
                🗑️
              </button>
            </div>
            <div class="session-time">{{ formatRelativeTime(session.updateTime) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ConfirmDialog
    v-if="showDeleteConfirm"
    title="删除会话"
    message="确定要删除这个会话吗？删除后不可恢复。"
    confirm-text="删除"
    cancel-text="取消"
    @confirm="confirmDeleteSession"
    @cancel="cancelDeleteSession"
  />
</template>

<style scoped>
.view-container {
  padding: var(--space-lg) var(--space-xl);
  height: 100%;
  overflow-y: auto;
}

.view-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
}

.view-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.view-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border: 1px solid var(--border-glass);
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.2);
  transform: translateY(-1px);
}

.content-area {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.session-item {
  position: relative;
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-xl);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.session-item:hover {
  border-color: color-mix(in srgb, var(--accent-primary) 35%, transparent);
  transform: translateX(6px);
  box-shadow: var(--shadow-md);
}

.session-item:hover .session-glow {
  opacity: 1;
}

.session-item:hover .session-content {
  background: var(--bg-hover);
}

.session-glow {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent-gradient);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.session-content {
  padding: 18px 20px 18px 22px;
  transition: background var(--transition-fast);
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.session-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 12px;
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.delete-btn {
  opacity: 0;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  background: var(--bg-glass);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(248, 113, 113, 0.15);
  transform: scale(1.1);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: 64px 32px;
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 56px;
  opacity: 0.5;
  filter: grayscale(0.5);
}

.empty-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 13px;
  opacity: 0.7;
}

.loader {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
