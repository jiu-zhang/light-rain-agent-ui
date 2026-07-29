<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '@renderer/stores'
import { providerApi } from '@renderer/api'
import type { ProviderWithSimpleModels } from '@renderer/types'
import TopBar from '@renderer/components/layout/TopBar.vue'
import SettingsModal from '@renderer/components/settings/SettingsModal.vue'
import ChatMessage from '@renderer/components/chat/ChatMessage.vue'

const MODEL_SEL_KEY = 'agent-ui-selected-model-id'

const chatStore = useChatStore()
const messagesContainer = ref<HTMLElement>()
const inputText = ref('')
const showSettings = ref(false)
const agentMode = ref(false)
const enabledProviders = ref<ProviderWithSimpleModels[]>([])
const selectedModelId = ref<number | null>(null)
const showModelPicker = ref(false)

/** AI 正在等待响应且尚未有任何输出内容时显示 loading */
const showLoading = computed(() => {
  if (!chatStore.loading) return false
  // 最后一条消息如果是 AI 的 CONTENT（已有内容）则隐藏
  const last = chatStore.messages[chatStore.messages.length - 1]
  return !(last?.role === 'assistant' && last?.type === 'CONTENT')
})

/** 所有启用的模型扁平列表（用于下拉选择） */
const enabledModels = computed(() =>
  enabledProviders.value.flatMap((p) =>
    (p.models || []).map((m) => ({ ...m, providerName: p.name }))
  )
)

/** 当前选中模型的显示名称 */
const currentModelLabel = computed(() => {
  const m = enabledModels.value.find((m) => m.id === selectedModelId.value)
  return m ? `${m.providerName} · ${m.name}` : '选择模型'
})

/** 加载启用的厂商和模型 */
async function loadEnabledModels(): Promise<void> {
  try {
    const res = await providerApi.listEnabledWithModels()
    if (res.code === 200 && res.data?.length) {
      enabledProviders.value = res.data
      // 恢复上次选择的模型，否则默认第一个
      const savedId = localStorage.getItem(MODEL_SEL_KEY)
      const validId = savedId ? Number(savedId) : null
      const exists = enabledModels.value.some((m) => m.id === validId)
      selectedModelId.value = exists ? validId : (enabledModels.value[0]?.id ?? null)
    }
  } catch {
    // 后端不可用时清空
    enabledProviders.value = []
    selectedModelId.value = null
  }
}

function selectModel(id: number): void {
  selectedModelId.value = id
  localStorage.setItem(MODEL_SEL_KEY, String(id))
  showModelPicker.value = false
}

function scrollToBottom(): void {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

watch(
  () => chatStore.messages.length,
  () => scrollToBottom()
)

async function handleSend(): Promise<void> {
  const text = inputText.value.trim()
  if (!text || chatStore.loading) return
  if (!chatStore.currentSessionId) {
    await chatStore.createSession()
  }
  chatStore.sendMessage(text, selectedModelId.value ? String(selectedModelId.value) : undefined, agentMode.value)
  inputText.value = ''
}

async function handleNewSession(): Promise<void> {
  await chatStore.createSession()
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const showEmpty = ref(true)
watch(
  () => chatStore.messages.length,
  (n) => {
    showEmpty.value = n === 0
  },
  { immediate: true }
)

function onDocumentClick(): void {
  showModelPicker.value = false
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick)
  await Promise.all([chatStore.loadSessions(), loadEnabledModels()])
  if (!chatStore.currentSessionId && chatStore.sessions.length > 0) {
    await chatStore.switchSession(chatStore.sessions[0].id)
  } else if (!chatStore.currentSessionId) {
    await chatStore.createSession()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <div class="chat-shell">
    <TopBar @open-settings="showSettings = true" @new-session="handleNewSession" />

    <div class="chat-area">
      <!-- 空状态 -->
      <div v-if="showEmpty" class="empty-state">
        <div class="empty-icon-wrapper">
          <div class="empty-icon">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <defs>
                <linearGradient id="emptyGrad" x1="0" y1="0" x2="80" y2="80">
                  <stop offset="0%" stop-color="#60a5fa" />
                  <stop offset="50%" stop-color="#34d399" />
                  <stop offset="100%" stop-color="#a78bfa" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="url(#emptyGrad)"
                stroke-width="1.5"
                fill="none"
                opacity="0.3"
              />
              <circle
                cx="40"
                cy="40"
                r="28"
                stroke="url(#emptyGrad)"
                stroke-width="1"
                fill="none"
                opacity="0.2"
              />
              <circle
                cx="40"
                cy="40"
                r="20"
                stroke="url(#emptyGrad)"
                stroke-width="0.8"
                fill="none"
                opacity="0.15"
              />
              <path
                d="M30 40l7 7 13-15"
                stroke="url(#emptyGrad)"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                filter="url(#glow)"
              />
            </svg>
          </div>
          <div class="icon-ring"></div>
          <div class="icon-ring ring-2"></div>
        </div>
        <h2 class="empty-title">Light Rain Agent</h2>
        <p class="empty-subtitle">智能 AI 助手 · 雨夜中的微光</p>
        <p class="empty-desc">告诉我你需要什么帮助，我会尽力协助你</p>
        <div class="empty-hints">
          <span class="hint-item">
            <span class="hint-icon">📁</span>
            <span class="hint-text">文件操作</span>
          </span>
          <span class="hint-item">
            <span class="hint-icon">🔧</span>
            <span class="hint-text">系统命令</span>
          </span>
          <span class="hint-item">
            <span class="hint-icon">🌐</span>
            <span class="hint-text">网络请求</span>
          </span>
          <span class="hint-item">
            <span class="hint-icon">⏱️</span>
            <span class="hint-text">定时任务</span>
          </span>
        </div>
      </div>

      <!-- 消息区 -->
      <div v-else ref="messagesContainer" class="messages-area">
        <ChatMessage v-for="(evt, i) in chatStore.messages" :key="i" :event="evt" />
        <div v-if="showLoading" class="loading-row">
          <div class="loading-avatar">
            <span>🤖</span>
          </div>
          <div class="loading-bubble">
            <div class="loading-indicator">
              <div class="loading-ring"></div>
              <div class="loading-dots"><span></span><span></span><span></span></div>
            </div>
            <span class="loading-text">AI 思考中</span>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="input-area">
        <div class="input-container">
          <div class="input-wrap">
            <textarea
              v-model="inputText"
              class="input-field"
              placeholder="发送消息给 AI 助手..."
              :disabled="chatStore.loading"
              rows="1"
              @keydown="handleKeydown"
            ></textarea>
          </div>
          <button
            v-if="!chatStore.loading"
            class="send-btn"
            :class="{ active: inputText.trim() }"
            :disabled="!inputText.trim()"
            @click="handleSend"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3.4 20.4L21 12L3.4 3.6L3 10.5L16 12L3 13.5L3.4 20.4Z" fill="currentColor" />
            </svg>
          </button>
          <button
            v-else
            class="send-btn stop-btn-send"
            @click="chatStore.interrupt()"
          >
            <div class="stop-icon-send"></div>
          </button>
        </div>
        <div class="input-toolbar">
          <div class="toolbar-left">
            <div
              class="toolbar-chip"
              :class="{ active: agentMode }"
              @click="agentMode = !agentMode"
            >
              <div class="chip-track">
                <div class="chip-thumb"></div>
              </div>
              <span>{{ agentMode ? 'Agent' : 'Chat' }}</span>
            </div>
            <div
              class="toolbar-chip model-chip"
              :class="{ active: showModelPicker }"
              @click.stop="showModelPicker = !showModelPicker"
            >
              <span class="chip-dot"></span>
              <span>{{ currentModelLabel }}</span>
              <span class="chip-arrow">▾</span>
              <div v-if="showModelPicker" class="toolbar-dropdown" @click.stop>
                <div v-for="p in enabledProviders" :key="p.id" class="dropdown-group">
                  <div class="dropdown-group-label">{{ p.name }}</div>
                  <div
                    v-for="m in p.models"
                    :key="m.id"
                    class="dropdown-option"
                    :class="{ active: selectedModelId === m.id }"
                    @click="selectModel(m.id)"
                  >
                    <span v-if="m.isDefault" class="dropdown-default">★</span>
                    {{ m.name }}
                  </div>
                </div>
                <div v-if="enabledModels.length === 0" class="dropdown-empty">暂无可用模型</div>
              </div>
            </div>
          </div>
          <div class="toolbar-right">
            <span class="toolbar-hint"><span class="hint-kbd">Enter</span> 发送 · <span class="hint-kbd">Shift+Enter</span> 换行</span>
          </div>
        </div>
      </div>
    </div>

    <SettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
/* ===== 主容器 ===== */
.chat-shell {
  position: fixed;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-glass);
  backdrop-filter: blur(2px);
}

/* 浅色主题下改用固态背景，避免玻璃叠加导致的色块不均 */
[data-theme="light"] .chat-shell {
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

/* ===== 空状态 ===== */
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
  font-size: 14px;
}

/* ===== 消息区 ===== */
.messages-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 70px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

@keyframes messageSlideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
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
  font-size: 14px;
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
  from { opacity: 0; }
  to { opacity: 1; }
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

/* ===== 输入区 ===== */
.input-area {
  padding: 12px 16px 16px;
  background: var(--bg-glass-strong);
  border-top: 1px solid var(--border-glass);
  position: relative;
  z-index: 2;
}

[data-theme="light"] .input-area {
  background: var(--bg-primary);
  padding: 12px 16px 14px;
}

.input-container {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border-glass);
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

[data-theme="light"] .input-container {
  box-shadow: var(--shadow-sm);
}

.input-container:focus-within {
  border-color: var(--border-glass);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

[data-theme="light"] .input-container:focus-within {
  border-color: var(--border-glass);
  box-shadow: var(--shadow-sm);
}

.input-wrap {
  flex: 1;
  position: relative;
}

.input-field {
  width: 100%;
  min-height: 24px;
  max-height: 150px;
  padding: 2px 4px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  resize: none;
  outline: none;
  line-height: 1.6;
}

.input-field::placeholder {
  color: var(--text-quaternary);
}

.send-btn {
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 10px;
  background: var(--bg-glass);
  color: var(--text-quaternary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  margin-bottom: 2px;
}

.send-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.send-btn.active {
  background: var(--accent-gradient);
  color: white;
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.35);
}

.send-btn.active:hover {
  box-shadow: 0 6px 28px rgba(96, 165, 250, 0.5);
  transform: scale(1.05);
}

.send-btn:disabled { cursor: not-allowed; }

.stop-btn-send {
  background: var(--accent-error) !important;
  color: white !important;
  opacity: 0.9;
}

.stop-btn-send:hover {
  opacity: 1;
  transform: scale(1.05);
}

.stop-icon-send {
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 3px;
}

/* ===== 输入工具栏 ===== */
.input-toolbar {
  max-width: 760px;
  margin: 8px auto 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.toolbar-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-glass);
  border: 1px solid var(--border-glass);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  user-select: none;
}

.toolbar-chip:hover {
  border-color: var(--border-accent);
  color: var(--text-primary);
}

.toolbar-chip.active {
  color: var(--accent-primary);
  border-color: var(--border-accent);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}

.chip-track {
  position: relative;
  width: 28px;
  height: 14px;
  background: var(--bg-quaternary);
  border-radius: 999px;
  transition: background 0.25s;
}

.toolbar-chip.active .chip-track {
  background: var(--accent-gradient);
}

.chip-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  background: var(--text-secondary);
  border-radius: 50%;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toolbar-chip.active .chip-thumb {
  transform: translateX(14px);
  background: white;
  box-shadow: 0 2px 6px rgba(96, 165, 250, 0.4);
}

.model-chip {
  position: relative;
  gap: 4px;
  max-width: 180px;
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-success);
  flex-shrink: 0;
}

.chip-arrow {
  font-size: 8px;
  color: var(--text-quaternary);
  flex-shrink: 0;
  transition: transform 0.2s;
}

.model-chip.active .chip-arrow { transform: rotate(180deg); }

.toolbar-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-elevated);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  padding: 6px;
  box-shadow: var(--shadow-glass-lg);
  z-index: 100;
  animation: dropdownIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(4px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.dropdown-group { margin-bottom: 4px; }
.dropdown-group:last-child { margin-bottom: 0; }

.dropdown-group-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 5px 10px 3px;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.dropdown-option:hover {
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  color: var(--text-primary);
}

.dropdown-option.active {
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font-weight: 600;
}

.dropdown-default { color: #fbbf24; font-size: 12px; }
.dropdown-empty { padding: 14px; text-align: center; font-size: 12px; color: var(--text-quaternary); }

.toolbar-hint {
  font-size: 11px;
  color: var(--text-quaternary);
}

.hint-kbd {
  padding: 1px 5px;
  background: var(--bg-glass);
  border-radius: 4px;
  font-family: var(--font-code);
  font-size: 10px;
  color: var(--text-tertiary);
}
</style>
