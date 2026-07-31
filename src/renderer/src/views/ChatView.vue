<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useChatStore } from '@renderer/stores'
import { providerApi } from '@renderer/api/provider'
import type { ProviderWithSimpleModels } from '@renderer/types'
import TopBar from '@renderer/components/layout/TopBar.vue'
import SettingsModal from '@renderer/components/settings/SettingsModal.vue'
import ChatMessage from '@renderer/components/chat/ChatMessage.vue'
import ChatInput from '@renderer/components/chat/ChatInput.vue'

const chatStore = useChatStore()
const messagesContainer = ref<HTMLElement | null>(null)
const showSettings = ref(false)
const enabledProviders = ref<ProviderWithSimpleModels[]>([])
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)

const showLoading = computed(() => {
  if (!chatStore.loading) return false
  const last = chatStore.messages[chatStore.messages.length - 1]
  return !(last?.role === 'assistant' && last?.type === 'CONTENT')
})

const showEmpty = ref(true)
watch(() => chatStore.messages.length, (n) => { showEmpty.value = n === 0 }, { immediate: true })

watch(() => chatStore.messages.length, () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTo({ top: messagesContainer.value.scrollHeight, behavior: 'smooth' })
  }
})

async function loadEnabledModels(): Promise<void> {
  try {
    const res = await providerApi.listEnabledWithModels()
    if (res.code === 200 && res.data?.length) {
      enabledProviders.value = res.data
      chatInputRef.value?.loadSavedModel()
    }
  } catch { enabledProviders.value = [] }
}

function handleNewSession(): void { chatStore.createSession() }

function handleSettingsClose(): void {
  showSettings.value = false
  loadEnabledModels()
}

function handleSend(text: string): void {
  if (!chatStore.currentSessionId) chatStore.createSession()
  const modelId = chatInputRef.value?.selectedModelId
  chatStore.sendMessage(text, modelId ? String(modelId) : undefined, chatInputRef.value?.agentMode ?? false)
}

function handleStop(): void { chatStore.interrupt() }

onMounted(async () => {
  await Promise.all([chatStore.loadSessions(), loadEnabledModels()])
  if (!chatStore.currentSessionId && chatStore.sessions.length > 0) {
    await chatStore.switchSession(chatStore.sessions[0].id)
  } else if (!chatStore.currentSessionId) {
    await chatStore.createSession()
  }
})
</script>

<template>
  <div class="chat-shell">
    <TopBar @open-settings="showSettings = true" @new-session="handleNewSession" />
    <div class="chat-area">
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
              <circle cx="40" cy="40" r="36" stroke="url(#emptyGrad)" stroke-width="1.5" fill="none" opacity="0.3" />
              <circle cx="40" cy="40" r="28" stroke="url(#emptyGrad)" stroke-width="1" fill="none" opacity="0.2" />
              <circle cx="40" cy="40" r="20" stroke="url(#emptyGrad)" stroke-width="0.8" fill="none" opacity="0.15" />
              <path d="M30 40l7 7 13-15" stroke="url(#emptyGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)" />
            </svg>
          </div>
          <div class="icon-ring" />
          <div class="icon-ring ring-2" />
        </div>
        <h2 class="empty-title">Light Rain Agent</h2>
        <p class="empty-subtitle">智能 AI 助手 · 雨夜中的微光</p>
        <p class="empty-desc">告诉我你需要什么帮助，我会尽力协助你</p>
        <div class="empty-hints">
          <span class="hint-item"><span class="hint-icon">📁</span><span class="hint-text">文件操作</span></span>
          <span class="hint-item"><span class="hint-icon">🔧</span><span class="hint-text">系统命令</span></span>
          <span class="hint-item"><span class="hint-icon">🌐</span><span class="hint-text">网络请求</span></span>
          <span class="hint-item"><span class="hint-icon">⏱️</span><span class="hint-text">定时任务</span></span>
        </div>
      </div>
      <div v-show="!showEmpty" ref="messagesContainer" class="messages-area">
        <ChatMessage v-for="(evt, i) in chatStore.messages" :key="i" :event="evt" />
        <div v-if="showLoading" class="loading-row">
          <div class="loading-avatar"><span>🤖</span></div>
          <div class="loading-bubble">
            <div class="loading-indicator">
              <div class="loading-ring" />
              <div class="loading-dots"><span /><span /><span /></div>
            </div>
            <span class="loading-text">AI 思考中</span>
          </div>
        </div>
      </div>
      <ChatInput ref="chatInputRef" :loading="chatStore.loading" :enabled-providers="enabledProviders" @send="handleSend" @stop="handleStop" />
    </div>
    <SettingsModal v-if="showSettings" @close="handleSettingsClose" />
  </div>
</template>

<style scoped>
.chat-shell { position: fixed; inset: 0; z-index: 1; display: flex; flex-direction: column; background: var(--bg-glass); backdrop-filter: blur(2px); }
[data-theme="light"] .chat-shell { background: var(--bg-primary); backdrop-filter: none; }
.chat-area { flex: 1; display: flex; flex-direction: column; position: relative; max-width: 900px; margin: 0 auto; width: 100%; height: 100%; min-height: 0; }
.empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; animation: fadeSlideUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); padding: 60px 32px; }
@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.empty-icon-wrapper { position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; }
.empty-icon { animation: float 4s ease-in-out infinite; filter: drop-shadow(0 0 30px rgba(96, 165, 250, 0.3)); z-index: 2; }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
.icon-ring { position: absolute; width: 90px; height: 90px; border-radius: 50%; border: 1px solid rgba(96, 165, 250, 0.2); animation: ringPulse 3s ease-in-out infinite; }
.icon-ring.ring-2 { width: 110px; height: 110px; border-color: rgba(167, 139, 250, 0.12); animation-delay: 0.5s; }
@keyframes ringPulse { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.05); opacity: 0.3; } }
.empty-title { font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #60a5fa, #34d399, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.02em; }
.empty-subtitle { font-size: 14px; color: var(--text-secondary); margin-top: -8px; letter-spacing: 0.05em; }
.empty-desc { font-size: 13px; color: var(--text-tertiary); margin-top: -4px; }
.empty-hints { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.hint-item { display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--bg-glass); border: 1px solid var(--border-glass); border-radius: 999px; font-size: 13px; color: var(--text-tertiary); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
.hint-item:hover { border-color: var(--border-accent); color: var(--accent-primary); background: color-mix(in srgb, var(--accent-primary) 8%, transparent); transform: translateY(-2px); box-shadow: 0 4px 20px rgba(96, 165, 250, 0.15); }
.hint-icon { font-size: 14px; }
.messages-area { flex: 1; min-height: 0; overflow-y: auto; padding: 70px 24px 40px; display: flex; flex-direction: column; gap: 2px; }
.loading-row { display: flex; align-items: flex-start; gap: 10px; margin-top: 6px; align-self: flex-start; animation: fadeIn 0.3s ease; }
.loading-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; margin-top: 4px; background: linear-gradient(135deg, #38bdf8, #a78bfa); box-shadow: 0 2px 8px rgba(56, 189, 248, 0.25); }
.loading-bubble { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--bg-card); backdrop-filter: blur(16px); border: 1px solid var(--border-glass); border-radius: 4px 18px 18px 18px; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.loading-indicator { position: relative; width: 24px; height: 24px; flex-shrink: 0; }
.loading-ring { position: absolute; inset: 0; border: 2px solid rgba(96, 165, 250, 0.15); border-top-color: #60a5fa; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-dots { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 2px; }
.loading-dots span { width: 4px; height: 4px; background: linear-gradient(135deg, #60a5fa, #34d399); border-radius: 50%; animation: bounce 1.4s ease-in-out infinite; }
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%,100% { transform: translateY(0); opacity: 0.5; } 50% { transform: translateY(-4px); opacity: 1; } }
.loading-text { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
</style>
