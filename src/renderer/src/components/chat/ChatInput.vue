<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { ProviderWithSimpleModels, Attachment } from '@renderer/types'
import { chatApi } from '@renderer/api/chat'
import { notifyError } from '@renderer/utils/feedback'
import Icon from '@renderer/components/common/Icon.vue'
import ModePopover from '@renderer/components/chat/ModePopover.vue'
import ModelPicker from '@renderer/components/chat/ModelPicker.vue'

const MODEL_SEL_KEY = 'agent-ui-selected-model-id'
const AGENT_MODE_KEY = 'agent-ui-agent-mode'
const PLAN_MODE_KEY = 'agent-ui-plan-mode'
const DEEP_THINK_KEY = 'agent-ui-deep-think'

/** 支持深度思考的厂商 code（DeepSeek 不支持，不显示开关） */
const DEEP_THINK_PROVIDERS = ['dashscope', 'openai', 'ollama']

/** 待发送附件（uploading 为上传中状态标记） */
interface PendingAttachment extends Attachment {
  uploading?: boolean
}

const props = defineProps<{
  loading: boolean
  enabledProviders: ProviderWithSimpleModels[]
}>()

const emit = defineEmits<{
  send: [text: string, attachments: Attachment[]]
  stop: []
}>()

const inputText = ref('')
const showModelPicker = ref(false)
const showModePopover = ref(false)
const agentMode = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(AGENT_MODE_KEY) === '1'
)
const planMode = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(PLAN_MODE_KEY) === '1'
)
const deepThink = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(DEEP_THINK_KEY) === '1'
)
const selectedModelId = ref<number | null>(null)

// ─── 附件状态 ───────────────────────────────
const attachments = ref<PendingAttachment[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

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

/** 当前选中模型的厂商 code（用于按厂商显示深度思考开关） */
const currentProviderCode = computed(
  () =>
    props.enabledProviders.find((p) => p.models.some((m) => m.id === selectedModelId.value))
      ?.code ?? ''
)

const supportsDeepThink = computed(() => DEEP_THINK_PROVIDERS.includes(currentProviderCode.value))

const canSend = computed(() => inputText.value.trim().length > 0 || attachments.value.length > 0)

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

function toggleDeepThink(): void {
  deepThink.value = !deepThink.value
  localStorage.setItem(DEEP_THINK_KEY, deepThink.value ? '1' : '0')
}

/** 是否图片类型（用于缩略图展示） */
function isImageType(mimeType?: string): boolean {
  return !!mimeType && mimeType.startsWith('image/')
}

function pickFiles(): void {
  fileInputRef.value?.click()
}

function onFileSelected(e: Event): void {
  const input = e.target as HTMLInputElement
  void addFiles(input.files)
  input.value = ''
}

/** 添加文件：图片走附件上传；其他类型文件把本地路径插入输入框（供模型直接读取） */
async function addFiles(files: FileList | File[] | null): Promise<void> {
  if (!files || files.length === 0) return
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) {
      insertLocalFilePath(file)
      continue
    }
    const previewUrl = URL.createObjectURL(file)
    const localPath = resolveLocalPath(file)
    if (localPath) {
      attachments.value.push({
        fileId: '',
        name: file.name,
        mimeType: file.type,
        size: file.size,
        previewUrl,
        localPath
      })
      continue
    }
    const item: PendingAttachment = {
      fileId: '',
      name: file.name,
      mimeType: file.type,
      size: file.size,
      previewUrl,
      uploading: true
    }
    attachments.value.push(item)
    try {
      const uploaded = await chatApi.uploadAttachment(file)
      item.fileId = uploaded.fileId
      item.name = uploaded.name || file.name
      item.mimeType = uploaded.mimeType || file.type
      item.size = uploaded.size ?? file.size
      item.uploading = false
    } catch (e) {
      URL.revokeObjectURL(previewUrl)
      const idx = attachments.value.indexOf(item)
      if (idx >= 0) attachments.value.splice(idx, 1)
      notifyError(e instanceof Error ? e.message : '上传失败')
    }
  }
}

/** 获取本地文件的绝对路径（Electron webUtils），失败返回空串 */
function resolveLocalPath(file: File): string {
  try {
    return window.api.getPathForFile?.(file) || ''
  } catch {
    return ''
  }
}

/** 将非图片文件的本地路径插入输入框；拿不到路径时退化为文件名 */
function insertLocalFilePath(file: File): void {
  const path = resolveLocalPath(file) || file.name
  const existing = inputText.value
  const sep = existing && !/\s$/.test(existing) ? ' ' : ''
  inputText.value = existing + sep + path
}

function removeAttachment(index: number): void {
  const att = attachments.value[index]
  if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl)
  attachments.value.splice(index, 1)
}

function clearAttachments(): void {
  for (const att of attachments.value) {
    if (att.previewUrl) URL.revokeObjectURL(att.previewUrl)
  }
  attachments.value = []
}

/** 粘贴图片（Ctrl+V） */
function handlePaste(e: ClipboardEvent): void {
  const files = e.clipboardData?.files
  if (files && files.length > 0) {
    void addFiles(files)
    e.preventDefault()
  }
}

/** 拖拽图片到输入框 */
function handleDrop(e: DragEvent): void {
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    e.preventDefault()
    void addFiles(files)
  }
}

function handleSend(): void {
  if (props.loading) return
  if (!canSend.value) return
  if (attachments.value.some((a) => a.uploading)) {
    notifyError('附件正在上传，请稍候')
    return
  }
  const payload: Attachment[] = attachments.value.map((a) => ({
    fileId: a.fileId,
    name: a.name,
    mimeType: a.mimeType,
    size: a.size,
    localPath: a.localPath
  }))
  emit('send', inputText.value.trim(), payload)
  inputText.value = ''
  clearAttachments()
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function onDocumentClick(): void {
  showModelPicker.value = false
  showModePopover.value = false
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', onDocumentClick)
}

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  clearAttachments()
})

// 暴露给父组件调用
defineExpose({ agentMode, planMode, deepThink, selectedModelId })
</script>

<template>
  <div class="input-area">
    <div
      class="input-container"
      :class="{ 'drag-over': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop="handleDrop"
      @paste="handlePaste"
    >
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        class="hidden-file-input"
        @change="onFileSelected"
      />

      <!-- 拖拽提示层 -->
      <div v-if="dragOver" class="drag-area">
        <div class="drag-area-content">
          <Icon name="image" :size="28" class="drag-icon" />
          拖拽图片到这里上传
        </div>
      </div>

      <!-- 已选附件预览条 -->
      <div v-if="attachments.length" class="attachment-bar">
        <div
          v-for="(att, i) in attachments"
          :key="att.previewUrl || att.fileId"
          class="attachment-chip"
        >
          <img
            v-if="att.previewUrl && isImageType(att.mimeType)"
            :src="att.previewUrl"
            class="attachment-thumb"
            :alt="att.name"
          />
          <span v-else class="attachment-file-icon"><Icon name="image" :size="16" /></span>
          <span class="attachment-name" :title="att.name">{{ att.name }}</span>
          <Icon v-if="att.uploading" name="loader" :size="12" class="attachment-loading" />
          <button
            class="attachment-remove"
            :title="'移除 ' + att.name"
            @click.stop="removeAttachment(i)"
          >
            <Icon name="x" :size="12" />
          </button>
        </div>
        <div class="attachment-tip">
          <Icon name="image" :size="11" />
          <span>图片将随消息发送给模型</span>
        </div>
      </div>

      <div class="input-row">
        <div class="input-wrap">
          <textarea
            v-model="inputText"
            class="input-field"
            placeholder="发送消息给 AI 助手...（可上传图片进行多模态对话）"
            :disabled="loading"
            rows="1"
            @keydown="handleKeydown"
          />
        </div>
        <button
          v-if="!loading"
          class="send-btn"
          :class="{ active: canSend }"
          :disabled="!canSend"
          @click="handleSend"
        >
          <Icon name="send" :size="18" />
        </button>
        <button v-else class="send-btn stop-btn-send" @click="emit('stop')">
          <Icon name="square" :size="14" />
        </button>
      </div>

      <!-- 命令栏：高频工具 + 模型选择 -->
      <div class="input-commandbar">
        <div class="command-left">
          <button
            class="command-btn attach-btn"
            title="上传图片（支持多选 / 粘贴 / 拖拽）"
            @click="pickFiles"
          >
            <Icon name="paperclip" :size="15" />
          </button>
          <ModePopover
            :show="showModePopover"
            :agent-mode="agentMode"
            :plan-mode="planMode"
            :deep-think="deepThink"
            :supports-deep-think="supportsDeepThink"
            @update:show="showModePopover = $event"
            @toggle-agent="toggleAgentMode"
            @toggle-plan="togglePlanMode"
            @toggle-think="toggleDeepThink"
          />
        </div>
        <div class="command-right">
          <ModelPicker
            :show="showModelPicker"
            :enabled-providers="enabledProviders"
            :selected-model-id="selectedModelId"
            :current-model-label="currentModelLabel"
            @update:show="showModelPicker = $event"
            @select="selectModel"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-area {
  padding: 12px 16px 16px;
  background: var(--bg-glass-strong);
  border-top: 1px solid var(--border-glass);
  position: relative;
  z-index: 2;
}
[data-theme='light'] .input-area {
  background: var(--bg-primary);
  padding: 12px 16px 14px;
}
.input-container {
  max-width: 760px;
  margin: 0 auto;
  padding: 10px 14px 8px;
  background: var(--bg-elevated);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border-glass);
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  position: relative;
}
[data-theme='light'] .input-container {
  box-shadow: var(--shadow-sm);
}
.input-container::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 16px;
  right: 16px;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(96, 165, 250, 0.7),
    rgba(167, 139, 250, 0.7),
    transparent
  );
  opacity: 0.6;
  pointer-events: none;
}
.input-container:focus-within {
  border-color: var(--border-glass);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(96, 165, 250, 0.16),
    0 0 28px rgba(96, 165, 250, 0.22),
    0 0 56px rgba(139, 92, 246, 0.12);
}
[data-theme='light'] .input-container:focus-within {
  box-shadow:
    var(--shadow-sm),
    0 0 0 1px rgba(96, 165, 250, 0.18),
    0 8px 28px rgba(96, 165, 250, 0.2);
}
.input-container::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(
    160deg,
    rgba(96, 165, 250, 0.35),
    transparent 30%,
    transparent 70%,
    rgba(52, 211, 153, 0.25)
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.7;
  pointer-events: none;
  transition: opacity 0.3s;
}
.input-container:focus-within::after {
  opacity: 1;
}
.input-container.drag-over {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 30%, transparent);
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.hidden-file-input {
  display: none;
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
  background: linear-gradient(135deg, #60a5fa, #8b5cf6, #34d399);
  background-size: 200% 200%;
  color: white;
  animation: btnGlow 2.6s ease-in-out infinite;
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.4);
}
@keyframes btnGlow {
  0%,
  100% {
    background-position: 0% 50%;
    box-shadow: 0 4px 20px rgba(96, 165, 250, 0.4);
  }
  50% {
    background-position: 100% 50%;
    box-shadow: 0 4px 26px rgba(139, 92, 246, 0.5);
  }
}
.send-btn.active:hover {
  box-shadow: 0 6px 30px rgba(96, 165, 250, 0.55);
  transform: scale(1.05);
}
.send-btn:disabled {
  cursor: not-allowed;
}
.stop-btn-send {
  background: var(--accent-error) !important;
  color: white !important;
  opacity: 0.9;
}
.stop-btn-send:hover {
  opacity: 1;
  transform: scale(1.05);
}

/* 附件预览条 */
.attachment-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border-glass);
}
.attachment-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 4px;
  background: var(--bg-glass);
  border: 1px solid var(--border-glass);
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 220px;
  animation: chipIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes chipIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.attachment-thumb {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: 7px;
  flex-shrink: 0;
}
.attachment-file-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  border-radius: 7px;
  color: var(--accent-primary);
  flex-shrink: 0;
}
.attachment-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}
.attachment-loading {
  color: var(--accent-primary);
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.attachment-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-quaternary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.attachment-remove:hover {
  background: var(--accent-error);
  color: white;
}
.attachment-tip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-quaternary);
}

/* 文件拖拽区域 */
.drag-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent-primary) 5%, transparent);
  border: 2px dashed var(--accent-primary);
  border-radius: var(--radius-lg);
  color: var(--accent-primary);
  font-weight: 600;
  font-size: 13px;
  backdrop-filter: blur(12px);
  animation: pulse 1.5s infinite;
  z-index: 10;
}

.drag-area-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.drag-icon {
  opacity: 0.7;
}

/* 命令栏：内嵌于输入框底部的工具条 */
.input-commandbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-glass);
}
.command-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.command-right {
  display: flex;
  align-items: center;
}
.command-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  user-select: none;
  position: relative;
}
.command-btn:hover {
  border-color: var(--border-accent);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-primary) 6%, transparent);
}
.attach-btn {
  color: var(--accent-primary);
}
.attach-btn:hover {
  color: var(--accent-primary);
}
</style>
