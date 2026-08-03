<script setup lang="ts">
/**
 * 会话历史页面 - 科技感设计
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { chatApi } from '@renderer/api/chat'
import { useChatStore } from '@renderer/stores'
import { formatRelativeTime, downloadTextFile } from '@renderer/utils'
import type { Session } from '@renderer/types'
import ConfirmDialog from '@renderer/components/common/ConfirmDialog.vue'
import Icon from '@renderer/components/common/Icon.vue'

const router = useRouter()
const chatStore = useChatStore()

const sessions = ref<Session[]>([])
const loading = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref<string | null>(null)
const renamingId = ref<string | null>(null)
const renameText = ref('')
const search = ref('')
const exportingId = ref<string | null>(null)
const exportMenuFor = ref<string | null>(null)

/** 搜索过滤 + 按日期分组（今天 / 昨天 / 更早） */
const groupedSessions = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  const filtered = keyword
    ? sessions.value.filter((s) => (s.title || '新对话').toLowerCase().includes(keyword))
    : sessions.value

  const groups: { label: string; list: Session[] }[] = [
    { label: '今天', list: [] },
    { label: '昨天', list: [] },
    { label: '更早', list: [] }
  ]
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86400000
  for (const s of filtered) {
    const t = new Date(s.updateTime).getTime()
    if (t >= startOfToday) groups[0].list.push(s)
    else if (t >= startOfYesterday) groups[1].list.push(s)
    else groups[2].list.push(s)
  }
  return groups.filter((g) => g.list.length > 0)
})

/** 导出会话为 Markdown */
async function exportSessionMarkdown(s: Session): Promise<void> {
  const lines = await buildExportLines(s)
  if (lines) {
    downloadTextFile(`${s.title || '会话'}.md`, lines.join('\n'), 'text/markdown;charset=utf-8')
  }
  exportMenuFor.value = null
}

/** 导出会话为纯文本 */
async function exportSessionText(s: Session): Promise<void> {
  const lines = await buildExportLines(s)
  if (lines) {
    downloadTextFile(`${s.title || '会话'}.txt`, lines.join('\n'), 'text/plain;charset=utf-8')
  }
  exportMenuFor.value = null
}

/** 拉取会话消息并构建导出内容（失败返回 null） */
async function buildExportLines(s: Session): Promise<string[] | null> {
  exportingId.value = s.id
  try {
    const res = await chatApi.getMessages({ sessionId: s.id, page: 1, size: 200 })
    const messages = res.data?.list ?? []
    const lines: string[] = [`# ${s.title || '新对话'}`, '']
    for (const m of messages) {
      const roleLabel = m.role === 'user' ? '用户' : m.role === 'tool' ? '工具' : 'AI'
      lines.push(`**${roleLabel}**`, '', m.content, '')
    }
    return lines
  } catch {
    return null
  } finally {
    exportingId.value = null
  }
}

function startRename(session: Session): void {
  renamingId.value = session.id
  renameText.value = session.title || '新对话'
}

async function saveRename(): Promise<void> {
  const id = renamingId.value
  if (!id) return
  const title = renameText.value.trim()
  renamingId.value = null
  if (!title) return
  try {
    await chatApi.renameSession(id, title)
    const target = sessions.value.find((s) => s.id === id)
    if (target) target.title = title
  } catch {
    // 已由拦截器统一提示
  }
}

function cancelRename(): void {
  renamingId.value = null
}

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

function onDocClick(): void {
  exportMenuFor.value = null
}

onMounted(() => {
  loadSessions()
  document.addEventListener('click', onDocClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<template>
  <div class="view-container session-view">
    <div class="view-header">
      <div class="header-content">
        <h1 class="view-title">会话历史</h1>
        <p class="view-desc">查看和管理历史会话</p>
      </div>
      <div class="header-actions">
        <div class="search-wrap">
          <Icon name="search" :size="15" class="search-icon" />
          <input v-model="search" class="search-input" type="text" placeholder="搜索会话标题..." />
        </div>
        <button class="action-btn" @click="loadSessions">
          <Icon name="refresh" :size="14" />
          <span>刷新</span>
        </button>
      </div>
    </div>

    <div class="content-area">
      <div v-if="loading" class="loading-state">
        <div class="loader"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="sessions.length === 0" class="empty-state">
        <div class="empty-state-icon">
          <Icon name="history" :size="28" />
        </div>
        <span class="empty-state-text">暂无会话</span>
        <span class="empty-state-hint">开始一段新对话吧</span>
        <button class="empty-state-cta" @click="router.push('/')">
          <Icon name="plus" :size="14" />
          开始新对话
        </button>
      </div>

      <div v-else-if="groupedSessions.length === 0" class="empty-state">
        <div class="empty-state-icon">
          <Icon name="search" :size="28" />
        </div>
        <span class="empty-state-text">没有匹配的会话</span>
        <span class="empty-state-hint">换个关键词试试</span>
      </div>

      <div v-else class="session-list">
        <div v-for="(group, gi) in groupedSessions" :key="group.label" class="session-group">
          <div class="group-label">{{ group.label }}</div>
          <div
            v-for="(session, si) in group.list"
            :key="session.id"
            class="session-item"
            :style="{ '--item-delay': (gi * 0.05 + si * 0.03) + 's' }"
            @click="openSession(session.id)"
          >
            <div class="item-accent"></div>
            <div class="item-avatar">
              <Icon name="chat" :size="16" />
            </div>
            <div class="item-body">
              <div class="item-row">
                <input
                  v-if="renamingId === session.id"
                  v-model="renameText"
                  class="rename-input"
                  placeholder="会话标题"
                  @keydown.enter="saveRename"
                  @keydown.esc="cancelRename"
                  @blur="saveRename"
                  @click.stop
                />
                <span v-else class="item-title">{{ session.title || '新对话' }}</span>
                <span class="item-time">{{ formatRelativeTime(session.updateTime) }}</span>
              </div>
            </div>
            <div class="item-actions">
              <div class="export-wrap">
                <button
                  class="mini-btn"
                  title="导出会话"
                  :disabled="exportingId === session.id"
                  @click.stop="exportMenuFor = exportMenuFor === session.id ? null : session.id"
                >
                  <Icon v-if="exportingId === session.id" name="loader" :size="12" class="spin" />
                  <Icon v-else name="download" :size="12" />
                </button>
                <div v-if="exportMenuFor === session.id" class="export-menu" @click.stop>
                  <button class="export-option" @click="exportSessionMarkdown(session)">
                    导出 Markdown
                  </button>
                  <button class="export-option" @click="exportSessionText(session)">
                    导出纯文本
                  </button>
                </div>
              </div>
              <button class="mini-btn edit" title="重命名" @click.stop="startRename(session)">
                <Icon name="edit" :size="12" />
              </button>
              <button class="mini-btn del" title="删除" @click.stop="deleteSession(session.id)">
                <Icon name="trash" :size="12" />
              </button>
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
  </div>
</template>

<style scoped>
/* ===== 会话历史 · 页面专属样式 ===== */

/* Header 内联搜索 */
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.search-wrap {
  position: relative;
  width: 300px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-quaternary);
  pointer-events: none;
}

.search-wrap .search-input {
  width: 100%;
  padding: 8px 14px 8px 36px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  box-sizing: border-box;
}

.search-wrap .search-input:hover:not(:focus) {
  border-color: var(--border-hover);
}

.search-wrap .search-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.16);
}

/* 内容区 */
.content-area {
  animation: contentFadeIn 0.25s var(--ease-out);
}

@keyframes contentFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 日期分组 */
.session-group {
  margin-bottom: var(--space-lg);
}

/* 会话列表 */
.session-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* 会话卡片项 */
.session-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
  animation: itemIn 0.35s var(--ease-out) both;
  animation-delay: var(--item-delay, 0s);
}

@keyframes itemIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.session-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
  transform: translateX(2px);
}

/* 左侧渐变光条 */
.item-accent {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  border-radius: 0 2px 2px 0;
  background: var(--accent-gradient-tech);
  transition: height var(--transition-fast);
}

.session-item:hover .item-accent {
  height: 40%;
}

/* 会话图标 */
.item-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.session-item:hover .item-avatar {
  background: var(--accent-gradient);
  border-color: transparent;
  color: white;
  box-shadow: var(--glow-accent-sm);
}

/* 主体 */
.item-body {
  flex: 1;
  min-width: 0;
}

.item-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.item-time {
  font-size: 12px;
  color: var(--text-quaternary);
  white-space: nowrap;
  flex-shrink: 0;
}

/* 重命名输入 */
.rename-input {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.16);
}

/* 操作按钮组 */
.item-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.session-item:hover .item-actions {
  opacity: 1;
}

/* 导出菜单 */
.export-wrap {
  position: relative;
  display: flex;
}

.export-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 20;
  min-width: 140px;
  padding: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  animation: menuIn 0.15s var(--ease-out);
}

@keyframes menuIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.export-option {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: left;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.export-option:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 响应式 */
@media (max-width: 768px) {
  .search-wrap {
    width: 180px;
  }
}
</style>
