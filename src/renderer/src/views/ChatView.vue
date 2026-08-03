<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@renderer/stores'
import { providerApi } from '@renderer/api/provider'
import type { ChatEvent, ProviderWithSimpleModels } from '@renderer/types'
import TopBar from '@renderer/components/layout/TopBar.vue'
import ChatMessage from '@renderer/components/chat/ChatMessage.vue'
import ChatInput from '@renderer/components/chat/ChatInput.vue'
import ExecutionPanel from '@renderer/components/chat/ExecutionPanel.vue'
import InputDialog from '@renderer/components/chat/InputDialog.vue'
import Icon from '@renderer/components/common/Icon.vue'
import type { SendOptions } from '@renderer/stores/chat'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const messagesContainer = ref<HTMLElement | null>(null)
const enabledProviders = ref<ProviderWithSimpleModels[]>([])
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)

/** 执行面板是否展开 */
const execOpen = ref(false)

// 从设置/模型页返回时刷新模型列表
watch(
  () => route.path,
  (path) => {
    if (path === '/') loadEnabledModels()
  }
)

const showLoading = computed(() => {
  if (!chatStore.loading) return false
  const last = chatStore.messages[chatStore.messages.length - 1]
  return !(last?.role === 'assistant' && last?.type === 'CONTENT')
})

const showEmpty = ref(true)
watch(
  () => chatStore.messages.length,
  (n) => {
    showEmpty.value = n === 0
  },
  { immediate: true }
)

/** 滚动到底部（nextTick 确保新消息 DOM 已渲染，避免刷新后停留在顶部） */
function scrollToBottom(): void {
  nextTick(() => {
    const c = messagesContainer.value
    if (!c) return
    c.scrollTo({ top: c.scrollHeight })
    onMessagesScroll()
  })
}

watch(
  () => chatStore.messages.length,
  () => {
    scrollToBottom()
  }
)

// 流式输出时若用户停留在底部附近，持续跟随滚动
watch(
  () => chatStore.messages[chatStore.messages.length - 1]?.content,
  () => {
    const c = messagesContainer.value
    if (!c) return
    if (c.scrollTop + c.clientHeight >= c.scrollHeight - 80) {
      scrollToBottom()
    }
  }
)

async function loadEnabledModels(): Promise<void> {
  try {
    const res = await providerApi.listEnabledWithModels()
    if (res.code === 200 && res.data?.length) {
      enabledProviders.value = res.data
    }
  } catch {
    enabledProviders.value = []
  }
}

function handleNewSession(): void {
  chatStore.createSession()
}

function openSettings(): void {
  router.push('/settings')
}

function handleSend(text: string): void {
  sendText(text)
}

/** 发送文本（空态快捷提问与输入框共用） */
function sendText(text: string): void {
  if (!chatStore.currentSessionId) chatStore.createSession()
  const modelId = chatInputRef.value?.selectedModelId
  const options: SendOptions = {
    agentMode: chatInputRef.value?.agentMode ?? false,
    plan: chatInputRef.value?.planMode ?? false
  }
  chatStore.sendMessage(text, modelId ? String(modelId) : undefined, options)
}

/** 空态快捷提问 */
const quickPrompts = [
  {
    icon: 'folder',
    label: '文件操作',
    prompt: '帮我列出当前目录下的所有文件，并简要说明每个文件的用途'
  },
  { icon: 'wrench', label: '系统命令', prompt: '帮我查看一下当前系统的运行状态' },
  { icon: 'globe', label: '网络请求', prompt: '帮我抓取一个网页的内容并总结要点' },
  { icon: 'clock', label: '定时任务', prompt: '帮我创建一个每天上午 9 点执行的定时任务' }
]

function handleStop(): void {
  chatStore.interrupt()
}

function handleRegenerate(): void {
  chatStore.regenerate()
}

/** 判断消息是否为当前正在流式输出的 AI 回复 */
function isStreaming(evt: ChatEvent): boolean {
  if (!chatStore.loading) return false
  const last = chatStore.messages[chatStore.messages.length - 1]
  return evt.role === 'assistant' && evt.type === 'CONTENT' && evt.uid === last?.uid
}

// ─── 右侧悬浮目录与滚动条 ───────────────────────────
const railVisible = ref(false)
const dragging = ref(false)
const thumbHeight = ref('40px')
const thumbTop = ref(0)
const activeUid = ref('')
let dragStartY = 0
let dragStartScroll = 0

/** 目录：只收录用户提问 */
const outline = computed(() =>
  chatStore.messages
    .filter((m) => m.role === 'user' && m.content)
    .map((m) => ({ uid: m.uid, text: firstLineOf(m.content!) }))
)

function firstLineOf(text: string): string {
  const line = text.split('\n')[0].trim()
  return line.length > 24 ? line.slice(0, 24) + '…' : line
}

/** 根据滚动位置更新缩略条位置与高亮的目录项 */
function onMessagesScroll(): void {
  const c = messagesContainer.value
  if (!c) return
  const trackH = c.clientHeight
  const thumbH = Math.max(24, (c.clientHeight / Math.max(c.scrollHeight, 1)) * trackH)
  thumbHeight.value = `${thumbH}px`
  const maxScroll = c.scrollHeight - c.clientHeight
  const ratio = maxScroll > 0 ? c.scrollTop / maxScroll : 0
  thumbTop.value = ratio * Math.max(0, trackH - thumbH)

  const containerTop = c.getBoundingClientRect().top + 80
  let current = ''
  for (const item of outline.value) {
    const el = c.querySelector(`[data-uid="${item.uid}"]`)
    if (el && (el as HTMLElement).getBoundingClientRect().top <= containerTop) {
      current = item.uid
    }
  }
  activeUid.value = current
}

/** 点击目录项，平滑滚动到对应消息 */
function scrollToMessage(uid: string): void {
  const c = messagesContainer.value
  if (!c) return
  const el = c.querySelector<HTMLElement>(`[data-uid="${uid}"]`)
  if (!el) return
  const target = c.scrollTop + (el.getBoundingClientRect().top - c.getBoundingClientRect().top) - 70
  c.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
}

/** 缩略条拖拽 */
function startDrag(e: MouseEvent): void {
  e.preventDefault()
  dragging.value = true
  dragStartY = e.clientY
  dragStartScroll = messagesContainer.value?.scrollTop ?? 0
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', endDrag)
}

function onDragMove(e: MouseEvent): void {
  const c = messagesContainer.value
  if (!c || !dragging.value) return
  const trackH = c.clientHeight
  const thumbH = Math.max(24, (c.clientHeight / Math.max(c.scrollHeight, 1)) * trackH)
  const maxScroll = c.scrollHeight - c.clientHeight
  const delta = e.clientY - dragStartY
  c.scrollTop = dragStartScroll + (delta / Math.max(1, trackH - thumbH)) * maxScroll
}

function endDrag(): void {
  dragging.value = false
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', endDrag)
}

/** 点击轨道（非缩略条）跳转到对应位置 */
function onTrackMouseDown(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (target.classList.contains('rail-thumb')) {
    startDrag(e)
    return
  }
  const c = messagesContainer.value
  const track = e.currentTarget as HTMLElement
  if (!c || !track) return
  const trackH = c.clientHeight
  const thumbH = Math.max(24, (c.clientHeight / Math.max(c.scrollHeight, 1)) * trackH)
  const maxScroll = c.scrollHeight - c.clientHeight
  const rect = track.getBoundingClientRect()
  const ratio = (e.clientY - rect.top - thumbH / 2) / Math.max(1, trackH - thumbH)
  c.scrollTop = Math.min(maxScroll, Math.max(0, ratio * maxScroll))
}

onBeforeUnmount(() => {
  endDrag()
})

onMounted(async () => {
  await Promise.all([chatStore.loadSessions(), loadEnabledModels()])
  if (!chatStore.currentSessionId && chatStore.sessions.length > 0) {
    await chatStore.switchSession(chatStore.sessions[0].id)
  } else if (!chatStore.currentSessionId) {
    await chatStore.createSession()
  }
  nextTick(() => onMessagesScroll())
})
</script>

<template>
  <div class="chat-shell">
    <TopBar
      :exec-active="execOpen"
      @open-settings="openSettings"
      @new-session="handleNewSession"
      @toggle-exec="execOpen = !execOpen"
    />
    <div class="chat-area">
      <div v-if="showEmpty" class="empty-state">
        <div class="empty-icon-wrapper">
          <div class="empty-icon">
            <Icon name="sparkles" :size="48" />
          </div>
          <div class="icon-ring" />
          <div class="icon-ring ring-2" />
        </div>
        <h2 class="empty-title">Light Rain Agent</h2>
        <p class="empty-subtitle">智能 AI 助手 · 雨夜中的微光</p>
        <p class="empty-desc">告诉我你需要什么帮助，我会尽力协助你</p>
        <div class="empty-hints">
          <button
            v-for="q in quickPrompts"
            :key="q.label"
            class="hint-item"
            :title="q.prompt"
            @click="sendText(q.prompt)"
          >
            <Icon :name="q.icon as any" :size="15" class="hint-icon" />
            <span class="hint-text">{{ q.label }}</span>
          </button>
        </div>
      </div>
      <div v-show="!showEmpty" class="chat-scroll-wrap">
        <div ref="messagesContainer" class="messages-area" @scroll="onMessagesScroll">
          <ChatMessage
            v-for="evt in chatStore.messages"
            :key="evt.uid"
            :event="evt"
            :streaming="isStreaming(evt)"
            @regenerate="handleRegenerate"
          />
          <div v-if="showLoading" class="loading-row">
            <div class="loading-avatar"><Icon name="robot" :size="16" /></div>
            <div class="loading-bubble">
              <div class="loading-indicator">
                <div class="loading-ring" />
                <div class="loading-dots"><span /><span /><span /></div>
              </div>
              <span class="loading-text">AI 思考中</span>
            </div>
          </div>
        </div>

        <!-- 右侧悬浮栏：提问目录 + 滚动条（悬停显示） -->
        <div class="chat-rail">
          <div
            class="rail-hit-zone"
            @mouseenter="railVisible = true"
            @mouseleave="railVisible = false"
          ></div>
          <div
            class="rail-body"
            :class="{ visible: railVisible || dragging }"
            @mouseenter="railVisible = true"
            @mouseleave="railVisible = false"
          >
            <div class="rail-outline">
              <div class="rail-outline-inner">
                <div class="rail-title">提问目录</div>
                <div v-if="outline.length" class="rail-items">
                  <button
                    v-for="item in outline"
                    :key="item.uid"
                    class="rail-item"
                    :class="{ active: item.uid === activeUid }"
                    :title="item.text"
                    @click="scrollToMessage(item.uid)"
                  >
                    {{ item.text }}
                  </button>
                </div>
                <div v-else class="rail-empty">暂无提问</div>
              </div>
            </div>
            <div class="rail-scrollbar" @mousedown="onTrackMouseDown">
              <div
                class="rail-thumb"
                :style="{ height: thumbHeight, transform: `translateY(${thumbTop}px)` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
      <ChatInput
        ref="chatInputRef"
        :loading="chatStore.loading"
        :enabled-providers="enabledProviders"
        @send="handleSend"
        @stop="handleStop"
      />
    </div>
    <ExecutionPanel
      :open="execOpen"
      :plan-steps="chatStore.planSteps"
      :tool-runs="chatStore.toolRuns"
      :is-plan-running="chatStore.isPlanRunning"
      :plan-goal="chatStore.planGoal"
      :loading="chatStore.loading"
      @close="execOpen = false"
      @view-history="router.push('/executions')"
    />
    <InputDialog />
  </div>
</template>

<style scoped>
.chat-shell {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-glass);
  backdrop-filter: blur(2px);
}
[data-theme='light'] .chat-shell {
  background: var(--bg-primary);
  backdrop-filter: none;
}
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  animation: fadeSlideUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  padding: 60px 32px;
}
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.empty-icon-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-icon {
  animation: float 4s ease-in-out infinite;
  filter: drop-shadow(0 0 30px rgba(96, 165, 250, 0.3));
  z-index: 2;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}
.icon-ring {
  position: absolute;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 1px solid rgba(96, 165, 250, 0.2);
  animation: ringPulse 3s ease-in-out infinite;
}
.icon-ring.ring-2 {
  width: 110px;
  height: 110px;
  border-color: rgba(167, 139, 250, 0.12);
  animation-delay: 0.5s;
}
@keyframes ringPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.3;
  }
}
.empty-title {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #34d399, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}
.empty-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: -8px;
  letter-spacing: 0.05em;
}
.empty-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: -4px;
}
.empty-hints {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 8px;
}
.hint-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-glass);
  border: 1px solid var(--border-glass);
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-tertiary);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.hint-item:hover {
  border-color: var(--border-accent);
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.15);
}
.hint-icon {
  color: var(--accent-primary);
}
.chat-scroll-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.messages-area {
  height: 100%;
  overflow-y: auto;
  padding: 70px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: var(--chat-msg-gap, 8px);
  scrollbar-width: none;
}
.messages-area::-webkit-scrollbar {
  display: none;
}

/* 右侧悬浮栏：提问目录 + 滚动条 */
.chat-rail {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.rail-hit-zone {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 16px;
  pointer-events: auto;
}

.rail-body {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 210px;
  padding-right: 4px;
  display: flex;
  align-items: stretch;
  opacity: 0;
  transform: translateX(12px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  pointer-events: none;
  background: linear-gradient(
    270deg,
    color-mix(in srgb, var(--bg-elevated) 92%, transparent),
    color-mix(in srgb, var(--bg-elevated) 40%, transparent) 65%,
    transparent
  );
}

.rail-body.visible {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.rail-outline {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 16px 8px 16px 16px;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
}
.rail-outline::-webkit-scrollbar {
  display: none;
}

/* 目录整体垂直居中：内容少时居中，超出后自动从顶部滚动 */
.rail-outline-inner {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rail-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 8px 8px;
  flex-shrink: 0;
}

.rail-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rail-item {
  display: block;
  width: 100%;
  text-align: center;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.rail-item:hover {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: var(--text-primary);
}

.rail-item.active {
  background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
  color: var(--accent-primary);
}

.rail-empty {
  font-size: 12px;
  color: var(--text-quaternary);
  padding: 8px;
}

.rail-scrollbar {
  position: relative;
  width: 6px;
  flex-shrink: 0;
  margin: 8px 3px;
  border-radius: 999px;
  cursor: pointer;
}

.rail-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 24px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 40%, transparent);
  cursor: grab;
  transition: background 0.2s ease;
}

.rail-thumb:hover {
  background: var(--accent-primary);
}
.loading-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 6px;
  align-self: flex-start;
  animation: fadeIn 0.3s ease;
}
.loading-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  margin-top: 4px;
  background: linear-gradient(135deg, #38bdf8, #a78bfa);
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.25);
}
.loading-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-glass);
  border-radius: 4px 18px 18px 18px;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.loading-indicator {
  position: relative;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.loading-ring {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(96, 165, 250, 0.15);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.loading-dots {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.loading-dots span {
  width: 4px;
  height: 4px;
  background: linear-gradient(135deg, #60a5fa, #34d399);
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}
.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  50% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
.loading-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
