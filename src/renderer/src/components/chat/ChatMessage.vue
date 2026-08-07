<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { attachmentUrl, localAttachmentUrl } from '@renderer/api'
import { notifyError, notifyInfo, notifySuccess } from '@renderer/utils/feedback'
import type { Attachment, ChatTurn, PlanStep } from '@renderer/types'
import Icon from '@renderer/components/common/Icon.vue'
import MarkdownContent from './blocks/MarkdownContent.vue'
import PlanTimeline from './blocks/PlanTimeline.vue'
import ReasoningBlock from './blocks/ReasoningBlock.vue'
import ToolCard from './blocks/ToolCard.vue'

const props = defineProps<{
  /** 一轮对话（用户提问或一次完整的 AI 回复） */
  turn: ChatTurn
  /** 是否为当前正在流式输出的 AI 回复 */
  streaming?: boolean
}>()

const emit = defineEmits<{ regenerate: [] }>()

const isUser = computed(() => props.turn.role === 'user')

const isError = computed(() => !isUser.value && !!props.turn.error)

/** 当前消息是否可重新生成（已完成且有正文的 AI 回复） */
const canRegenerate = computed(
  () =>
    !isUser.value &&
    !props.streaming &&
    props.turn.events.some((e) => e.type === 'CONTENT' && e.content)
)

/** 附件是否为图片（用于缩略图展示） */
function isImageAttachment(att: Attachment): boolean {
  if (att.mimeType) return att.mimeType.startsWith('image/')
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(att.name)
}

/** 图片预览（轻量灯箱） */
const lightboxUrl = ref<string | null>(null)
function openLightbox(url: string): void {
  lightboxUrl.value = url
}
function closeLightbox(): void {
  lightboxUrl.value = null
}

/** 正在流式输出的正文事件 uid（用于定位光标） */
const streamingContentUid = computed(() => {
  if (!props.streaming || isUser.value) return ''
  const evts = props.turn.events
  for (let i = evts.length - 1; i >= 0; i--) {
    const e = evts[i]
    if (e.type === 'CONTENT' && e.content) return e.uid
  }
  return ''
})

/** 思考块展开状态：只记录用户手动切换；默认流式中展开、完成后闭合 */
const reasoningOpen = ref<Record<string, boolean>>({})

function isReasoningOpen(uid: string): boolean {
  return reasoningOpen.value[uid] ?? props.streaming
}

function toggleReasoning(uid: string): void {
  reasoningOpen.value[uid] = !isReasoningOpen(uid)
}

// 输出完成后默认闭合所有思考块，用户可手动展开
watch(
  () => props.streaming,
  (now, prev) => {
    if (prev === true && now === false) {
      for (const key of Object.keys(reasoningOpen.value)) reasoningOpen.value[key] = false
    }
  }
)

/** 是否有思考内容 */
const hasReasoning = computed(() =>
  props.turn.events.some((e) => e.type === 'REASONING' && e.content)
)

/** 思考计时（秒）：流式输出中递增，完成后定格（参考 DeepSeek「深度思考用时」） */
const reasoningElapsed = ref(0)
let elapsedStart = 0
let elapsedTimer: ReturnType<typeof setInterval> | undefined

function startElapsed(): void {
  if (elapsedTimer) return
  elapsedStart = Date.now()
  reasoningElapsed.value = 0
  elapsedTimer = setInterval(() => {
    reasoningElapsed.value = Math.floor((Date.now() - elapsedStart) / 1000)
  }, 500)
}
function stopElapsed(): void {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = undefined
  }
}

watch([() => props.streaming, hasReasoning], ([streaming, has]) => {
  if (streaming && has) startElapsed()
  else stopElapsed()
})
onBeforeUnmount(() => {
  stopElapsed()
  if (copyTimer) clearTimeout(copyTimer)
})

const aiIcon = computed<'bot' | 'alert-triangle'>(() => (isError.value ? 'alert-triangle' : 'bot'))

/** 工具卡片展开/收起 */
const expanded = ref<Record<string, boolean>>({})
function isExpanded(uid: string): boolean {
  return expanded.value[uid] ?? false
}
function toggleExpanded(uid: string): void {
  expanded.value[uid] = !isExpanded(uid)
}

interface PlanStartInfo {
  goal: string
  totalSteps: number
  steps: PlanStep[]
}

/** 计划开始信息（PLAN_START） */
function planStartInfo(evt: { content?: string }): PlanStartInfo | null {
  if (!evt.content) return null
  try {
    const plan = JSON.parse(evt.content)
    return {
      goal: plan.goal,
      totalSteps: plan.totalSteps,
      steps: (plan.steps || []) as PlanStep[]
    }
  } catch {
    return null
  }
}

interface PlanStepInfo {
  index: number
  name: string
  status: string
  error?: string
}

/** 计划步骤信息（PLAN_STEP） */
function planStepInfo(evt: { content?: string }): PlanStepInfo | null {
  if (!evt.content) return null
  try {
    const step = JSON.parse(evt.content)
    return {
      index: step.index,
      name: step.name,
      status: step.status,
      error: step.error
    }
  } catch {
    return null
  }
}

interface PlanStepView {
  index: number
  name: string
  status: string
  error?: string
}

/**
 * 聚合 PLAN_START / PLAN_STEP / PLAN_DONE 为单一计划时间线：
 * 以 PLAN_START 的步骤列表为骨架，叠加后续步骤状态更新，完成后统一置为已完成。
 */
const planView = computed<{
  goal: string
  total: number
  completed: number
  percent: number
  steps: PlanStepView[]
} | null>(() => {
  const evts = props.turn.events
  const startEvt = evts.find((e) => e.type === 'PLAN_START')
  const start = startEvt ? planStartInfo(startEvt) : null
  if (!start) return null
  const steps: PlanStepView[] = (start.steps || []).map((s, i) => ({
    index: i + 1,
    name: s.name,
    status: 'RUNNING'
  }))
  for (const e of evts) {
    if (e.type !== 'PLAN_STEP') continue
    const info = planStepInfo(e)
    if (!info) continue
    const st = steps.find((s) => s.index === info.index)
    if (st) {
      st.status = info.status
      if (info.error) st.error = info.error
    }
  }
  if (evts.some((e) => e.type === 'PLAN_DONE')) {
    for (const s of steps) if (s.status === 'RUNNING') s.status = 'COMPLETED'
  }
  const completed = steps.filter((s) => s.status === 'COMPLETED').length
  return {
    goal: start.goal || '',
    total: steps.length,
    completed,
    percent: steps.length ? Math.round((completed / steps.length) * 100) : 0,
    steps
  }
})

/** 计划是否仍在执行中（存在运行中的步骤） */
const planActive = computed(
  () => planView.value?.steps.some((s) => s.status === 'RUNNING') ?? false
)

/** 剔除已被计划时间线消费的 PLAN_STEP / PLAN_DONE 事件 */
const renderableEvents = computed(() =>
  props.turn.events.filter((e) => e.type !== 'PLAN_STEP' && e.type !== 'PLAN_DONE')
)

/** 可复制文本：用户消息取原文，AI 回复取思考+正文 */
const copyableText = computed(() => {
  if (isUser.value) return props.turn.content ?? ''
  return props.turn.events
    .filter((e) => (e.type === 'CONTENT' || e.type === 'REASONING') && e.content)
    .map((e) => e.content)
    .join('\n\n')
})

/** 复制按钮的"已复制"反馈状态 */
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

function setCopiedFeedback(): void {
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = false), 1500)
}

/** 复制消息内容（带成功/失败反馈） */
async function copyContent(): Promise<void> {
  const text = props.turn.error || copyableText.value
  try {
    await navigator.clipboard.writeText(text)
    setCopiedFeedback()
    notifySuccess('已复制到剪贴板')
  } catch {
    // clipboard API 不可用时回退到 execCommand
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      if (ok) {
        setCopiedFeedback()
        notifySuccess('已复制到剪贴板')
        return
      }
    } catch {
      // 忽略 execCommand 异常，统一走失败提示
    }
    notifyError('复制失败，请手动选择内容复制')
  }
}

/** 重新生成按钮的防重复点击状态 */
const regenerating = ref(false)

function onRegenerate(): void {
  if (regenerating.value) return
  regenerating.value = true
  notifyInfo('正在重新生成，请稍候…')
  emit('regenerate')
}

// 重新生成完成后（streaming 结束）复位按钮状态
watch(
  () => props.streaming,
  (now, prev) => {
    if (prev === true && now === false) regenerating.value = false
  }
)
</script>

<template>
  <div
    class="msg-row"
    :data-uid="turn.uid"
    :class="{
      'is-user': isUser,
      'is-ai': !isUser && !isError,
      'is-error': isError
    }"
  >
    <!-- AI 头像（左侧） -->
    <div v-if="!isUser" class="msg-avatar">
      <Icon :name="aiIcon" :size="14" />
    </div>

    <!-- 空白占位（用户消息右侧头像用） -->
    <div v-else class="avatar-spacer"></div>

    <!-- 气泡 + 操作按钮（纵向列布局） -->
    <div class="msg-col">
      <div class="msg-bubble">
        <!-- 用户消息：附件 + 正文 -->
        <template v-if="isUser">
          <div v-if="turn.attachments?.length" class="msg-attachments">
            <div
              v-for="att in turn.attachments"
              :key="att.fileId || att.localPath"
              class="msg-attach-item"
              :class="{ 'is-image': isImageAttachment(att) }"
              :title="att.name"
            >
              <img
                v-if="isImageAttachment(att)"
                :src="att.localPath ? localAttachmentUrl(att.localPath) : attachmentUrl(att.fileId)"
                :alt="att.name"
                class="msg-attach-img"
                loading="lazy"
                @click.stop="
                  openLightbox(
                    att.localPath ? localAttachmentUrl(att.localPath) : attachmentUrl(att.fileId)
                  )
                "
              />
              <div v-else class="msg-attach-file">
                <Icon name="file" :size="14" />
                <span class="msg-attach-file-name">{{ att.name }}</span>
              </div>
            </div>
          </div>
          <MarkdownContent v-if="turn.content" :content="turn.content" is-user />
        </template>

        <!-- AI 回复：思考/工具/正文等统一归入一个气泡 -->
        <template v-else>
          <!-- AI 尚未输出任何事件时的"思考中"占位（紧随用户提问下方） -->
          <div v-if="streaming && !turn.events.length" class="thinking-block">
            <div class="thinking-indicator">
              <div class="thinking-ring" />
              <div class="thinking-dots"><span /><span /><span /></div>
            </div>
            <span class="thinking-text">AI 思考中</span>
          </div>

          <div v-for="evt in renderableEvents" :key="evt.uid" class="turn-event">
            <!-- 计划：聚合为单一时间线（在 PLAN_START 处渲染） -->
            <PlanTimeline
              v-if="evt.type === 'PLAN_START' && planView"
              :plan-view="planView"
              :active="planActive"
            />

            <!-- 思考内容：流式中展开（带脉冲动画/计时），完成后默认闭合，可手动切换 -->
            <ReasoningBlock
              v-else-if="evt.type === 'REASONING' && evt.content"
              :uid="evt.uid"
              :content="evt.content"
              :streaming="streaming"
              :open="isReasoningOpen(evt.uid)"
              :elapsed="reasoningElapsed"
              @toggle="toggleReasoning(evt.uid)"
            />

            <!-- 工具调用：结构化卡片 -->
            <ToolCard
              v-else-if="evt.type === 'TOOL_CALL'"
              kind="call"
              :evt="evt"
              :open="isExpanded(evt.uid)"
              @toggle="toggleExpanded(evt.uid)"
            />

            <!-- 工具结果：结构化卡片 -->
            <ToolCard
              v-else-if="evt.type === 'TOOL_CONTENT'"
              kind="result"
              :evt="evt"
              :open="isExpanded(evt.uid)"
              @toggle="toggleExpanded(evt.uid)"
            />

            <!-- 醒目提示（如多模态降级：已忽略图片后继续） -->
            <div v-else-if="evt.type === 'NOTICE' && evt.content" class="notice-banner">
              <Icon name="alert" :size="13" />
              <span>{{ evt.content }}</span>
            </div>

            <!-- 状态提示（重试/中断/轮次等） -->
            <div v-else-if="evt.type === 'STATUS' && evt.content" class="status-line">
              {{ evt.content }}
            </div>

            <!-- 等待用户输入 -->
            <div v-else-if="evt.type === 'INPUT_REQUEST'" class="status-line">等待用户输入...</div>

            <!-- 正文：markdown -->
            <MarkdownContent
              v-else-if="evt.type === 'CONTENT' && evt.content"
              :content="evt.content"
              :with-cursor="evt.uid === streamingContentUid"
            />
          </div>

          <div v-if="turn.error" class="msg-error-block">
            <Icon name="alert-triangle" :size="13" />
            <span>{{ turn.error }}</span>
          </div>
        </template>
      </div>

      <!-- 气泡下方操作按钮 -->
      <div v-if="(isUser && turn.content) || (!isUser && turn.events.length)" class="msg-actions">
        <button
          class="msg-action-btn"
          :class="{ 'is-copied': copied }"
          :title="copied ? '已复制' : '复制消息内容'"
          aria-label="复制消息内容"
          @click="copyContent"
        >
          <Icon :name="copied ? 'check' : 'copy'" :size="12" />
          <span>{{ copied ? '已复制' : '复制' }}</span>
        </button>
        <button
          v-if="canRegenerate"
          class="msg-action-btn"
          :class="{ 'is-regenerating': regenerating }"
          title="重新生成"
          aria-label="重新生成"
          :disabled="regenerating"
          @click="onRegenerate"
        >
          <Icon name="refresh" :size="12" :class="{ spin: regenerating }" />
          <span>{{ regenerating ? '重新生成中…' : '重新生成' }}</span>
        </button>
      </div>
    </div>

    <!-- 用户头像（右侧） -->
    <div v-if="isUser" class="msg-avatar user-avatar">
      <Icon name="user" :size="14" />
    </div>
    <div v-else class="avatar-spacer"></div>
  </div>

  <!-- 图片灯箱预览 -->
  <Teleport to="body">
    <div v-if="lightboxUrl" class="lightbox" @click="closeLightbox">
      <img :src="lightboxUrl" class="lightbox-img" alt="" />
      <button class="lightbox-close" title="关闭" @click.stop="closeLightbox">
        <Icon name="x" :size="16" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: var(--chat-msg-gap, 8px) 0;
  animation: msgIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
}

@keyframes msgIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== 头像 ===== */
.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  margin-top: 4px;
}

.avatar-spacer {
  width: 32px;
  flex-shrink: 0;
}

/* AI 头像 */
.is-ai .msg-avatar,
.is-error .msg-avatar {
  background: linear-gradient(135deg, #38bdf8, #a78bfa);
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.25);
}

/* 用户头像 */
.user-avatar {
  background: var(--bg-quaternary);
  border: 1px solid var(--border-glass);
  box-shadow: none;
  font-size: 14px;
}

/* ===== 气泡 ===== */
.msg-col {
  display: flex;
  flex-direction: column;
  max-width: 78%;
  min-width: 0;
  position: relative;
}

.is-user .msg-col {
  margin-left: auto;
  align-items: flex-end;
}

.is-ai .msg-col,
.is-error .msg-col {
  align-items: flex-start;
}

.msg-bubble {
  max-width: 100%;
  min-width: 0;
  position: relative;
}

/* 用户气泡 - 浅卡片底色 */
.is-user .msg-bubble {
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: 18px 18px 4px 18px;
  padding: 10px 16px;
  box-shadow: var(--shadow-sm);
}

/* AI 气泡 - 左对齐 */
.is-ai .msg-bubble,
.is-error .msg-bubble {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px 18px 18px 18px;
  padding: 10px 14px;
}

/* 附件（图片等） */
.msg-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.is-user .msg-attachments {
  justify-content: flex-end;
}

/* AI 思考中占位（流式输出前，紧跟用户提问下方） */
.thinking-block {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  animation: thinkingIn 0.3s ease;
}
@keyframes thinkingIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.thinking-indicator {
  position: relative;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
.thinking-ring {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(96, 165, 250, 0.15);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: thinkingSpin 0.8s linear infinite;
}
@keyframes thinkingSpin {
  to {
    transform: rotate(360deg);
  }
}
.thinking-dots {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.thinking-dots span {
  width: 4px;
  height: 4px;
  background: linear-gradient(135deg, #60a5fa, #34d399);
  border-radius: 50%;
  animation: thinkingBounce 1.4s ease-in-out infinite;
}
.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes thinkingBounce {
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
.thinking-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}
.msg-attach-item {
  position: relative;
  max-width: 220px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
}
.msg-attach-item.is-image {
  cursor: zoom-in;
}
.msg-attach-img {
  display: block;
  width: 100%;
  max-width: 220px;
  max-height: 220px;
  object-fit: cover;
}
.msg-attach-file {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 220px;
}
.msg-attach-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 图片灯箱 */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  animation: fadeIn 0.2s ease;
}
.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.3);
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ===== 状态提示行 ===== */
.status-line {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.5;
  padding: 2px 0;
  margin-bottom: 4px;
}

/* ===== 醒目提示横幅（如多模态降级） ===== */
.notice-banner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 10px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.28);
  border-radius: 8px;
  word-break: break-word;
}

.notice-banner :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
}

/* ===== 错误 ===== */
.is-error .msg-bubble {
  border-color: rgba(248, 113, 113, 0.25);
}

.msg-error-block {
  color: #f87171;
  font-size: 13px;
  line-height: 1.6;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 消息操作按钮（气泡下方 - 复制/重新生成） */
.msg-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  padding: 0 4px;
  opacity: 0;
  transform: translateY(-2px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.msg-col:hover .msg-actions {
  opacity: 1;
  transform: translateY(0);
}

.msg-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.12s ease;
}

.msg-action-btn:hover {
  color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb), 0.08);
  border-color: rgba(var(--accent-primary-rgb), 0.22);
}

.msg-action-btn:active {
  transform: scale(0.94);
}

/* 复制成功：绿色反馈态 */
.msg-action-btn.is-copied {
  color: var(--accent-success);
  background: rgba(var(--accent-success-rgb), 0.1);
  border-color: rgba(var(--accent-success-rgb), 0.35);
}

.msg-action-btn.is-copied :deep(svg) {
  animation: copiedPop 0.3s ease;
}

@keyframes copiedPop {
  0% {
    transform: scale(0.6);
  }
  60% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}

/* 重新生成中：禁用 + 弱化 */
.msg-action-btn.is-regenerating {
  cursor: default;
  opacity: 0.75;
  color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb), 0.06);
}
</style>
