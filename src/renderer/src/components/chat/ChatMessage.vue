<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { closeOpenCodeBlock } from '@renderer/utils'
import type { ChatEvent } from '@renderer/types'
import Icon from '@renderer/components/common/Icon.vue'

const props = defineProps<{
  event: ChatEvent
  /** 是否为当前正在流式输出的消息（显示闪烁光标） */
  streaming?: boolean
}>()

const emit = defineEmits<{ regenerate: [] }>()

// 配置 marked 选项 + 代码块语法高亮
marked.setOptions({
  breaks: true,
  gfm: true
})

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      let highlighted: string
      try {
        highlighted =
          language === 'plaintext'
            ? hljs.highlightAuto(text).value
            : hljs.highlight(text, { language, ignoreIllegals: true }).value
      } catch {
        highlighted = hljs.highlightAuto(text).value
      }
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
    }
  }
})

const isUser = computed(() => props.event.role === 'user')

/** 当前消息是否可重新生成（最后一条 AI 回复） */
const canRegenerate = computed(
  () => props.event.role === 'assistant' && props.event.type === 'CONTENT'
)

// 按内容缓存渲染结果，流式重渲染时避免重复解析相同内容；上限 200 条防内存膨胀
const renderCache = new Map<string, string>()
const MAX_RENDER_CACHE = 200

const contentRef = ref<HTMLElement | null>(null)

const renderedContent = computed(() => {
  const content = props.event.content
  if (!content) return ''
  const cached = renderCache.get(content)
  if (cached !== undefined) return cached
  try {
    // 先补齐未闭合代码块，保证每次传给 marked 的都是结构完整的内容
    const sanitized = closeOpenCodeBlock(content)
    // marked 不提供净化能力，AI 输出可能携带恶意 HTML，渲染前必须用 DOMPurify 消毒
    const html = DOMPurify.sanitize(marked.parse(sanitized) as string)
    if (renderCache.size >= MAX_RENDER_CACHE) renderCache.clear()
    renderCache.set(content, html)
    // 流式输出时在末尾追加闪烁光标（cursor 为自研 span，净化后拼接，无注入风险）
    return props.streaming && !isUser.value ? html + '<span class="stream-cursor"></span>' : html
  } catch {
    return content
  }
})

// 渲染完成后为代码块挂载"复制"按钮（幂等，流式更新不会重复添加）
watch(
  renderedContent,
  () => {
    nextTick(() => {
      const root = contentRef.value
      if (!root) return
      root.querySelectorAll('pre').forEach((pre) => {
        if (pre.querySelector('.copy-btn')) return
        const code = pre.querySelector('code')
        if (!code) return
        const btn = document.createElement('button')
        btn.className = 'copy-btn'
        btn.textContent = '复制'
        btn.addEventListener('click', () => {
          const text = code.textContent ?? ''
          navigator.clipboard
            .writeText(text)
            .then(() => {
              btn.textContent = '已复制'
              setTimeout(() => (btn.textContent = '复制'), 1500)
            })
            .catch(() => (btn.textContent = '复制失败'))
        })
        pre.appendChild(btn)
      })
    })
  },
  { flush: 'post' }
)

const config = computed(() => {
  if (props.event.type === 'ERROR') {
    return { icon: 'alert-circle', label: '错误' }
  }
  if (isUser.value) {
    return { icon: 'user', label: '你' }
  }
  switch (props.event.type) {
    case 'CONTENT':
      return { icon: 'bot', label: 'AI' }
    case 'REASONING':
      return { icon: 'brain', label: '思考' }
    case 'TOOL_CALL':
      return { icon: 'zap', label: '调用工具' }
    case 'TOOL_CONTENT':
      return { icon: 'check', label: '工具结果' }
    case 'PLAN_START':
      return { icon: 'list', label: '计划开始' }
    case 'PLAN_STEP':
      return { icon: 'play-circle', label: '计划步骤' }
    case 'PLAN_DONE':
      return { icon: 'check-circle', label: '计划完成' }
    case 'STATUS':
      return { icon: 'circle', label: '' }
    default:
      return { icon: 'circle', label: props.event.type }
  }
})

/** 工具调用信息（TOOL_CALL） */
const toolCallInfo = computed(() => {
  if (props.event.type !== 'TOOL_CALL' || !props.event.content) return null
  try {
    const p = JSON.parse(props.event.content)
    const args = p.arguments
    const argsText = typeof args === 'string' ? args : args ? JSON.stringify(args, null, 2) : ''
    return { name: p.name || 'tool', args: argsText }
  } catch {
    return null
  }
})

const toolCallName = computed(() => toolCallInfo.value?.name ?? '工具调用')
const toolCallArgs = computed(() => toolCallInfo.value?.args ?? props.event.content ?? '')

/** 工具结果信息（TOOL_CONTENT） */
const toolContentInfo = computed(() => {
  if (props.event.type !== 'TOOL_CONTENT' || !props.event.content) return null
  try {
    const p = JSON.parse(props.event.content)
    const data = p.responseData !== undefined ? p.responseData : p
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    return { name: p.name || 'tool', result: text }
  } catch {
    return null
  }
})

/** 计划开始信息（PLAN_START） */
const planStartInfo = computed(() => {
  if (props.event.type !== 'PLAN_START' || !props.event.content) return null
  try {
    const plan = JSON.parse(props.event.content)
    return {
      planId: plan.planId,
      goal: plan.goal,
      totalSteps: plan.totalSteps,
      steps: plan.steps || []
    }
  } catch {
    return null
  }
})

/** 计划步骤信息（PLAN_STEP） */
const planStepInfo = computed(() => {
  if (props.event.type !== 'PLAN_STEP' || !props.event.content) return null
  try {
    const step = JSON.parse(props.event.content)
    return {
      planId: step.planId,
      index: step.index,
      name: step.name,
      status: step.status,
      error: step.error
    }
  } catch {
    return null
  }
})

const toolContentName = computed(() => toolContentInfo.value?.name ?? '工具结果')
const toolContentResult = computed(() => toolContentInfo.value?.result ?? props.event.content ?? '')

/** 工具卡片展开/收起 */
const expanded = ref(false)

/** 获取计划状态文本 */
function getStatusText(status: string): string {
  switch (status) {
    case 'RUNNING': return '执行中'
    case 'COMPLETED': return '已完成'
    case 'CANCELLED': return '已取消'
    case 'FAILED': return '失败'
    default: return status
  }
}

/** 复制消息内容 */
async function copyContent(): Promise<void> {
  const text = props.event.content ?? props.event.error ?? ''
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // clipboard API 不可用时回退到 execCommand
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}
</script>

<template>
  <div
    class="msg-row"
    :data-uid="event.uid"
    :class="{
      'is-user': isUser,
      'is-ai': !isUser && event.type === 'CONTENT',
      'is-reasoning': event.type === 'REASONING',
      'is-tool': event.type === 'TOOL_CALL' || event.type === 'TOOL_CONTENT',
      'is-plan-start': event.type === 'PLAN_START',
      'is-plan-step': event.type === 'PLAN_STEP',
      'is-plan-done': event.type === 'PLAN_DONE',
      'is-status': event.type === 'STATUS',
      'is-error': event.type === 'ERROR'
    }"
  >
    <!-- AI 头像（左侧） -->
    <div v-if="!isUser" class="msg-avatar">
      <Icon :name="config.icon as any" :size="14" />
    </div>

    <!-- 空白占位（用户消息右侧头像用） -->
    <div v-else class="avatar-spacer"></div>

    <!-- 气泡 + 操作按钮（纵向列布局） -->
    <div class="msg-col">
      <div class="msg-bubble">
        <!-- 工具调用：结构化卡片 -->
        <div v-if="event.type === 'TOOL_CALL'" class="tool-card">
          <div class="tool-card-header" @click="expanded = !expanded">
            <Icon name="zap" :size="12" class="tool-icon" />
            <span class="tool-name">{{ toolCallName }}</span>
            <span class="tool-toggle">{{ expanded ? '收起' : '查看参数' }}</span>
          </div>
          <pre v-if="expanded" class="tool-detail">{{ toolCallArgs }}</pre>
        </div>
        <!-- 工具结果：结构化卡片 -->
        <div v-else-if="event.type === 'TOOL_CONTENT'" class="tool-card tool-result">
          <div class="tool-card-header" @click="expanded = !expanded">
            <Icon name="check-circle" :size="12" class="tool-icon" />
            <span class="tool-name">{{ toolContentName }}</span>
            <span class="tool-toggle">{{ expanded ? '收起' : '查看结果' }}</span>
          </div>
          <pre v-if="expanded" class="tool-detail">{{ toolContentResult }}</pre>
        </div>
        <!-- 计划开始：结构化展示 -->
        <div v-else-if="event.type === 'PLAN_START' && planStartInfo" class="plan-card plan-start">
          <div class="plan-card-header">
            <Icon name="list" :size="12" class="plan-icon" />
            <span class="plan-title">计划启动</span>
            <span class="plan-steps">共 {{ planStartInfo.totalSteps }} 步</span>
          </div>
          <div class="plan-goal">{{ planStartInfo.goal }}</div>
          <div class="plan-steps-list">
            <div v-for="(step, index) in planStartInfo.steps" :key="index" class="plan-step-item">
              <span class="step-number">{{ index + 1 }}</span>
              <span class="step-name">{{ step.name }}</span>
            </div>
          </div>
        </div>
        <!-- 计划步骤：状态展示 -->
        <div v-else-if="event.type === 'PLAN_STEP' && planStepInfo" class="plan-card plan-step">
          <div class="plan-card-header">
            <Icon name="play-circle" :size="12" class="plan-icon" />
            <span class="plan-title">步骤 {{ planStepInfo.index }}</span>
            <span class="plan-status" :class="planStepInfo.status.toLowerCase()">
              {{ getStatusText(planStepInfo.status) }}
            </span>
          </div>
          <div class="plan-step-name">{{ planStepInfo.name }}</div>
          <div v-if="planStepInfo.error" class="plan-error">{{ planStepInfo.error }}</div>
        </div>
        <!-- 计划完成：简洁提示 -->
        <div v-else-if="event.type === 'PLAN_DONE'" class="plan-card plan-done">
          <div class="plan-card-header">
            <Icon name="check-circle" :size="12" class="plan-icon" />
            <span class="plan-title">计划执行完成</span>
          </div>
        </div>
        <!-- 其他类型用 markdown -->
        <div
          v-else-if="event.content"
          ref="contentRef"
          class="msg-content"
          v-html="renderedContent"
        ></div>
        <div v-if="event.error" class="msg-error-block">
          <Icon name="alert-triangle" :size="13" />
          <span>{{ event.error }}</span>
        </div>
      </div>
      <!-- 气泡下方操作按钮 -->
      <div v-if="event.content && event.type !== 'STATUS'" class="msg-actions">
        <button class="msg-action-btn" title="复制" @click="copyContent">
          <Icon name="copy" :size="12" />
          复制
        </button>
        <button
          v-if="canRegenerate"
          class="msg-action-btn"
          title="重新生成"
          @click="emit('regenerate')"
        >
          <Icon name="refresh" :size="12" />
          重新生成
        </button>
      </div>
    </div>

    <!-- 用户头像（右侧） -->
    <div v-if="isUser" class="msg-avatar user-avatar">
      <Icon :name="config.icon as any" :size="14" />
    </div>
    <div v-else class="avatar-spacer"></div>
  </div>
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
.is-reasoning .msg-avatar,
.is-tool .msg-avatar {
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

.is-status .msg-avatar {
  background: #38bdf8;
  opacity: 0.6;
}

.is-error .msg-avatar {
  background: linear-gradient(135deg, #f87171, #f472b6);
}

/* ===== 气泡 ===== */
.msg-col {
  display: flex;
  flex-direction: column;
  max-width: 75%;
  min-width: 0;
  position: relative;
}

.is-user .msg-col {
  margin-left: auto;
  align-items: flex-end;
}

.is-ai .msg-col,
.is-reasoning .msg-col,
.is-tool .msg-col,
.is-error .msg-col {
  align-items: flex-start;
}

.is-status .msg-col {
  align-items: center;
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

.is-user .msg-content {
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-word;
  font-size: var(--chat-font-size, 14px);
  overflow-wrap: break-word;
}

/* AI 气泡 - 左对齐 */
.is-ai .msg-bubble {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px 18px 18px 18px;
  padding: 10px 16px;
}

.is-ai .msg-content {
  color: var(--text-primary);
  line-height: 1.7;
  word-break: break-word;
  font-size: var(--chat-font-size, 14px);
  overflow-wrap: break-word;
}

.is-ai .msg-content :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.is-ai .msg-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

/* ===== 思考气泡 ===== */
.is-reasoning .msg-bubble {
  background: rgba(167, 139, 250, 0.08);
  border: 1px solid rgba(167, 139, 250, 0.15);
  border-radius: 4px 18px 18px 18px;
  padding: 8px 14px;
}

/* ===== 计划气泡 ===== */
.is-plan-start .msg-bubble,
.is-plan-step .msg-bubble,
.is-plan-done .msg-bubble {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 4px 18px 18px 18px;
  padding: 0;
}

.is-reasoning .msg-content {
  color: var(--text-secondary);
  font-size: 13px;
  font-style: italic;
  line-height: 1.6;
  word-break: break-word;
}

/* ===== 工具气泡 ===== */
.is-tool .msg-bubble {
  background: rgba(251, 146, 60, 0.06);
  border: 1px solid rgba(251, 146, 60, 0.12);
  border-radius: 4px 18px 18px 18px;
  padding: 8px 14px;
}

.is-tool .msg-content {
  font-family: var(--font-code);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 工具调用/结果卡片 */
.tool-card {
  background: rgba(251, 146, 60, 0.06);
  border: 1px solid rgba(251, 146, 60, 0.15);
  border-radius: 10px;
  overflow: hidden;
  max-width: 100%;
}

/* 计划卡片 */
.plan-card {
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 12px;
  overflow: hidden;
  max-width: 100%;
  padding: 12px 16px;
}

.plan-card.plan-start {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.2);
}

.plan-card.plan-step {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.15);
}

.plan-card.plan-done {
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.2);
}

.plan-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.plan-icon {
  color: var(--accent-primary);
}

.plan-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.plan-steps {
  font-size: 11px;
  color: var(--text-secondary);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.plan-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.plan-status.running {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.plan-status.completed {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.plan-status.cancelled {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}

.plan-status.failed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.plan-goal {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 10px;
  line-height: 1.5;
}

.plan-steps-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plan-step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent-primary);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-name {
  color: var(--text-secondary);
  flex: 1;
}

.plan-step-name {
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.plan-error {
  font-size: 12px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  padding: 6px 10px;
  border-radius: 6px;
  margin-top: 6px;
}

.tool-card.tool-result {
  background: rgba(34, 197, 94, 0.05);
  border-color: rgba(34, 197, 94, 0.15);
}

.tool-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.tool-card-header:hover {
  background: rgba(255, 255, 255, 0.04);
}

.tool-icon {
  flex-shrink: 0;
  color: var(--accent-primary);
}

.tool-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  font-family: var(--font-code);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-toggle {
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.tool-detail {
  margin: 0;
  padding: 8px 12px;
  max-height: 240px;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-tertiary);
  background: rgba(0, 0, 0, 0.25);
  font-family: var(--font-code);
  white-space: pre-wrap;
  word-break: break-all;
}

/* ===== 状态气泡 ===== */
.is-status {
  justify-content: center;
}

.is-status .msg-bubble {
  background: transparent;
  padding: 2px 0;
}

.is-status .msg-content {
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
  line-height: 1.4;
}

.is-status .msg-avatar {
  width: 6px;
  height: 6px;
  min-width: 6px;
  margin-top: 0;
  align-self: center;
  opacity: 0.5;
}

/* ===== 错误 ===== */
.is-error .msg-bubble {
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.15);
  border-radius: 4px 18px 18px 18px;
  padding: 8px 14px;
}

.is-error .msg-col {
  align-items: flex-start;
}

.msg-error-block {
  color: #f87171;
  font-size: 13px;
  line-height: 1.6;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ===== 代码块在气泡内 ===== */
.msg-content :deep(p) {
  margin: 0 0 6px;
}

.msg-content :deep(p:last-child) {
  margin-bottom: 0;
}

.msg-content :deep(code) {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-family: var(--font-code);
  font-size: 13px;
}

.is-user .msg-content :deep(code) {
  background: var(--bg-quaternary);
  color: var(--text-primary);
}

.msg-content :deep(pre) {
  margin: 8px 0;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  overflow-x: auto;
  max-width: 100%;
  position: relative;
}

.msg-content {
  min-width: 0;
  overflow-wrap: break-word;
}

/* 流式输出光标 */
.stream-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  border-radius: 1px;
  background: var(--accent-primary);
  box-shadow: 0 0 6px var(--accent-primary);
  animation: blink 1s step-end infinite;
}

.is-user .msg-content :deep(pre) {
  background: rgba(0, 0, 0, 0.25);
}

.msg-content :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
}

/* 代码块复制按钮 */
.msg-content :deep(.copy-btn) {
  position: absolute;
  top: 6px;
  right: 8px;
  padding: 2px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.4);
  color: var(--text-tertiary);
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.msg-content :deep(pre:hover .copy-btn) {
  opacity: 1;
}

/* 消息操作按钮（气泡下方 - 复制/重新生成） */
.msg-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.msg-col:hover .msg-actions {
  opacity: 1;
}

.msg-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.msg-action-btn:hover {
  color: var(--accent-primary);
  border-color: var(--border-accent);
  background: var(--bg-secondary);
  transform: translateY(-1px);
}

.msg-content :deep(a) {
  text-decoration: underline;
  transition: opacity 0.2s;
}

.is-user .msg-content :deep(a) {
  color: #c7d2fe;
}
.is-user .msg-content :deep(a:hover) {
  opacity: 0.8;
}
.is-ai .msg-content :deep(a) {
  color: var(--accent-primary);
}
.is-ai .msg-content :deep(a:hover) {
  color: var(--accent-secondary);
}

.msg-content :deep(ul),
.msg-content :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}

.msg-content :deep(li) {
  margin: 3px 0;
  line-height: 1.7;
}

.msg-content :deep(h1),
.msg-content :deep(h2),
.msg-content :deep(h3),
.msg-content :deep(h4) {
  margin: 12px 0 6px;
}

.is-user .msg-content :deep(h1),
.is-user .msg-content :deep(h2),
.is-user .msg-content :deep(h3),
.is-user .msg-content :deep(h4) {
  color: white;
}
</style>
