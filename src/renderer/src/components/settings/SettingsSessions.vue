<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { chatApi } from '@renderer/api/chat'
import { useChatStore } from '@renderer/stores'
import type { Session } from '@renderer/types'
import ConfirmDialog from '@renderer/components/common/ConfirmDialog.vue'

const router = useRouter()
const chatStore = useChatStore()
const sessions = ref<Session[]>([])
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref<string | null>(null)

const emit = defineEmits<{ close: [] }>()

async function loadSessions(): Promise<void> {
  try {
    const res = await chatApi.listSessions()
    if (res.code === 200) sessions.value = res.data || []
  } catch { sessions.value = [] }
}

function deleteSession(id: string): void {
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}

async function confirmDeleteSession(): Promise<void> {
  const id = pendingDeleteId.value
  if (!id) return
  try {
    await chatApi.deleteSession(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
  } catch (e) { console.warn(e) }
  finally { showDeleteConfirm.value = false; pendingDeleteId.value = null }
}

function cancelDeleteSession(): void {
  showDeleteConfirm.value = false
  pendingDeleteId.value = null
}

async function openSession(id: string): Promise<void> {
  await chatStore.switchSession(id)
  emit('close')
  router.push('/chat')
}

onMounted(loadSessions)
</script>

<template>
  <div v-if="sessions.length === 0" class="state-box">
    <span style="opacity: 0.4; font-size: 32px">💬</span>
    <span>暂无对话</span>
  </div>
  <div v-else class="list">
    <div v-for="s in sessions" :key="s.id" class="list-item" @click="openSession(s.id)">
      <div class="list-item-main">
        <div class="list-item-title">{{ s.title || '新对话' }}</div>
        <div class="list-item-meta">{{ new Date(s.updateTime).toLocaleString() }}</div>
      </div>
      <button class="del-btn" title="删除" @click.stop="deleteSession(s.id)">✕</button>
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
.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; color: var(--text-tertiary); font-size: 13px; }
.list { display: flex; flex-direction: column; gap: 6px; }
.list-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-glass); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.list-item:hover { background: var(--bg-hover); border-color: color-mix(in srgb, var(--accent-primary) 20%, transparent); transform: translateX(2px); }
.list-item-main { flex: 1; min-width: 0; }
.list-item-title { font-size: 14px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-item-meta { font-size: 12px; color: var(--text-tertiary); margin-top: 3px; }
.del-btn { opacity: 0; width: 26px; height: 26px; border: none; background: transparent; color: var(--text-tertiary); font-size: 12px; cursor: pointer; border-radius: 8px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; }
.list-item:hover .del-btn { opacity: 1; }
.del-btn:hover { background: color-mix(in srgb, var(--accent-error) 15%, transparent); color: var(--accent-error); }
</style>
