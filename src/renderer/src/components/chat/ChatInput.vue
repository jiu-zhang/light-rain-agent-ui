<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ProviderWithSimpleModels } from '@renderer/types'
import Icon from '@renderer/components/common/Icon.vue'

const MODEL_SEL_KEY = 'agent-ui-selected-model-id'
const AGENT_MODE_KEY = 'agent-ui-agent-mode'
const PLAN_MODE_KEY = 'agent-ui-plan-mode'

const props = defineProps<{
  loading: boolean
  enabledProviders: ProviderWithSimpleModels[]
}>()

const emit = defineEmits<{
  send: [text: string]
  stop: []
}>()

const inputText = ref('')
const showModelPicker = ref(false)
const agentMode = ref(typeof localStorage !== 'undefined' && localStorage.getItem(AGENT_MODE_KEY) === '1')
const planMode = ref(typeof localStorage !== 'undefined' && localStorage.getItem(PLAN_MODE_KEY) === '1')
const selectedModelId = ref<number | null>(null)

const enabledModels = computed(() =>
  props.enabledProviders.flatMap((p) =>
    (p.models || []).map((m) => ({ ...m, providerName: p.name }))
  )
)

/**
 * 模型列表变化时自动选择模型：
 * 当前选中仍有效 → 保留；否则恢复上次保存的选择 → 默认模型 → 第一个模型。
 * 用 watch 而非父组件回调，避免 props 尚未下发的时序问题。
 */
watch(
  enabledModels,
  (models) => {
    if (models.length === 0) {
      selectedModelId.value = null
      return
    }
    if (selectedModelId.value && models.some((m) => m.id === selectedModelId.value)) return
    const savedId = localStorage.getItem(MODEL_SEL_KEY)
    if (savedId && models.some((m) => m.id === Number(savedId))) {
      selectedModelId.value = Number(savedId)
      return
    }
    const defaultModel = models.find((m) => m.isDefault === 1)
    selectedModelId.value = defaultModel?.id ?? models[0]?.id ?? null
  },
  { immediate: true }
)

const currentModelLabel = computed(() => {
  const m = enabledModels.value.find((m) => m.id === selectedModelId.value)
  return m ? `${m.providerName} · ${m.name}` : '选择模型'
})

function selectModel(id: number): void {
  selectedModelId.value = id
  localStorage.setItem(MODEL_SEL_KEY, String(id))
  showModelPicker.value = false
}

function toggleAgentMode(): void {
  agentMode.value = !agentMode.value
  localStorage.setItem(AGENT_MODE_KEY, agentMode.value ? '1' : '0')
}

function togglePlanMode(): void {
  planMode.value = !planMode.value
  localStorage.setItem(PLAN_MODE_KEY, planMode.value ? '1' : '0')
}

function handleSend(): void {
  const text = inputText.value.trim()
  if (!text || props.loading) return
  emit('send', text)
  inputText.value = ''
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function onDocumentClick(): void {
  showModelPicker.value = false
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', onDocumentClick)
}

// 暴露给父组件调用
defineExpose({ agentMode, planMode, selectedModelId })
</script>

<template>
  <div class="input-area">
    <div class="input-container">
      <div class="input-wrap">
        <textarea
          v-model="inputText"
          class="input-field"
          placeholder="发送消息给 AI 助手..."
          :disabled="loading"
          rows="1"
          @keydown="handleKeydown"
        />
      </div>
      <button
        v-if="!loading"
        class="send-btn"
        :class="{ active: inputText.trim() }"
        :disabled="!inputText.trim()"
        @click="handleSend"
      >
        <Icon name="send" :size="18" />
      </button>
      <button v-else class="send-btn stop-btn-send" @click="emit('stop')">
        <Icon name="square" :size="14" />
      </button>
    </div>
    <div class="input-toolbar">
      <div class="toolbar-left">
        <div class="toolbar-chip" :class="{ active: agentMode }" @click="toggleAgentMode">
          <div class="chip-track"><div class="chip-thumb" /></div>
          <span>{{ agentMode ? 'Agent' : 'Chat' }}</span>
        </div>
        <div class="toolbar-chip" :class="{ active: planMode }" @click="togglePlanMode" title="按计划逐步执行任务">
          <Icon name="git-branch" :size="12" class="chip-icon plan-icon" />
          <span>{{ planMode ? '计划' : '普通' }}</span>
        </div>
        <div class="toolbar-chip model-chip" :class="{ active: showModelPicker }" @click.stop="showModelPicker = !showModelPicker">
          <Icon name="bot" :size="12" class="chip-icon" />
          <span>{{ currentModelLabel }}</span>
          <Icon name="chevron-down" :size="12" class="chip-arrow" />
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
                <span v-if="m.isDefault" class="dropdown-default"><Icon name="star" :size="11" /></span>
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
</template>

<style scoped>
.input-area { padding: 12px 16px 16px; background: var(--bg-glass-strong); border-top: 1px solid var(--border-glass); position: relative; z-index: 2; }
[data-theme="light"] .input-area { background: var(--bg-primary); padding: 12px 16px 14px; }
.input-container { max-width: 760px; margin: 0 auto; display: flex; align-items: flex-end; gap: 10px; padding: 10px 14px; background: var(--bg-elevated); backdrop-filter: blur(24px); border: 1px solid var(--border-glass); border-radius: 16px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); }
[data-theme="light"] .input-container { box-shadow: var(--shadow-sm); }
.input-container:focus-within { border-color: var(--border-glass); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); }
.input-wrap { flex: 1; position: relative; }
.input-field { width: 100%; min-height: 24px; max-height: 150px; padding: 2px 4px; border: none; background: transparent; color: var(--text-primary); font-size: 15px; font-family: inherit; resize: none; outline: none; line-height: 1.6; }
.input-field::placeholder { color: var(--text-quaternary); }
.send-btn { width: 38px; height: 38px; border: none; border-radius: 10px; background: var(--bg-glass); color: var(--text-quaternary); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); margin-bottom: 2px; }
.send-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-secondary); }
.send-btn.active { background: var(--accent-gradient); color: white; box-shadow: 0 4px 20px rgba(96, 165, 250, 0.35); }
.send-btn.active:hover { box-shadow: 0 6px 28px rgba(96, 165, 250, 0.5); transform: scale(1.05); }
.send-btn:disabled { cursor: not-allowed; }
.stop-btn-send { background: var(--accent-error) !important; color: white !important; opacity: 0.9; }
.stop-btn-send:hover { opacity: 1; transform: scale(1.05); }
.input-toolbar { max-width: 760px; margin: 8px auto 0; display: flex; align-items: center; justify-content: space-between; }
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-right { display: flex; align-items: center; }
.toolbar-chip { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; cursor: pointer; transition: all 0.2s; background: var(--bg-glass); border: 1px solid var(--border-glass); font-size: 12px; font-weight: 500; color: var(--text-tertiary); user-select: none; }
.toolbar-chip:hover { border-color: var(--border-accent); color: var(--text-primary); }
.toolbar-chip.active { color: var(--accent-primary); border-color: var(--border-accent); background: color-mix(in srgb, var(--accent-primary) 8%, transparent); }
.chip-track { position: relative; width: 28px; height: 14px; background: var(--bg-quaternary); border-radius: 999px; transition: background 0.25s; }
.toolbar-chip.active .chip-track { background: var(--accent-gradient); }
.chip-thumb { position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; background: var(--text-secondary); border-radius: 50%; transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toolbar-chip.active .chip-thumb { transform: translateX(14px); background: white; box-shadow: 0 2px 6px rgba(96, 165, 250, 0.4); }
.model-chip { position: relative; gap: 6px; max-width: 180px; }
.chip-icon { color: var(--accent-success); flex-shrink: 0; }
.plan-icon { color: var(--accent-primary); }
.chip-arrow { color: var(--text-quaternary); flex-shrink: 0; transition: transform 0.2s; }
.model-chip.active .chip-arrow { transform: rotate(180deg); }
.toolbar-dropdown { position: absolute; bottom: calc(100% + 6px); left: 0; min-width: 200px; max-height: 300px; overflow-y: auto; background: var(--bg-elevated); backdrop-filter: blur(24px); border: 1px solid var(--border-strong); border-radius: 12px; padding: 6px; box-shadow: var(--shadow-glass-lg); z-index: 100; animation: dropdownIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes dropdownIn { from { opacity: 0; transform: translateY(4px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
.dropdown-group { margin-bottom: 4px; }
.dropdown-group:last-child { margin-bottom: 0; }
.dropdown-group-label { font-size: 10px; font-weight: 600; color: var(--text-quaternary); text-transform: uppercase; letter-spacing: 0.06em; padding: 5px 10px 3px; }
.dropdown-option { display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-size: 13px; color: var(--text-secondary); border-radius: 8px; cursor: pointer; transition: all 0.15s; }
.dropdown-option:hover { background: color-mix(in srgb, var(--accent-primary) 8%, transparent); color: var(--text-primary); }
.dropdown-option.active { background: color-mix(in srgb, var(--accent-primary) 12%, transparent); color: var(--accent-primary); font-weight: 600; }
.dropdown-default { color: #fbbf24; display: flex; }
.dropdown-empty { padding: 14px; text-align: center; font-size: 12px; color: var(--text-quaternary); }
.toolbar-hint { font-size: 11px; color: var(--text-quaternary); }
.hint-kbd { padding: 1px 5px; background: var(--bg-glass); border-radius: 4px; font-family: var(--font-code); font-size: 10px; color: var(--text-tertiary); }
</style>
