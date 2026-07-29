<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import type { ChatEvent } from '@renderer/types'

const props = defineProps<{
  event: ChatEvent
}>()

// 配置 marked 选项
marked.setOptions({
  breaks: true,
  gfm: true
})

const isUser = computed(() => props.event.role === 'user')

/**
 * 补齐 content 中未闭合的 ``` 代码块标记，
 * 避免流式传输过程中 marked 把后续内容吞进代码块内。
 */
function closeOpenCodeBlocks(content: string): string {
  const backtickCount = (content.match(/```/g) || []).length
  if (backtickCount % 2 !== 0) {
    return content + '\n```'
  }
  return content
}

const renderedContent = computed(() => {
  if (!props.event.content) return ''
  try {
    // 先补齐未闭合代码块，保证每次传给 marked 的都是结构完整的内容
    const sanitized = closeOpenCodeBlocks(props.event.content)
    return marked.parse(sanitized) as string
  } catch {
    return props.event.content
  }
})

const config = computed(() => {
  if (props.event.type === 'ERROR') {
    return { icon: '✕', label: '错误' }
  }
  if (isUser.value) {
    return { icon: '👤', label: '你' }
  }
  switch (props.event.type) {
    case 'CONTENT':
      return { icon: '🤖', label: 'AI' }
    case 'REASONING':
      return { icon: '💭', label: '思考' }
    case 'TOOL_CALL':
      return { icon: '⚡', label: '调用工具' }
    case 'TOOL_CONTENT':
      return { icon: '✓', label: '工具结果' }
    case 'STATUS':
      return { icon: '●', label: '' }
    default:
      return { icon: '•', label: props.event.type }
  }
})

/** TOOL_CONTENT 内容尝试以 JSON 友好格式化显示 */
const toolDisplayText = computed(() => {
  if (props.event.type !== 'TOOL_CONTENT' || !props.event.content) return ''
  try {
    const parsed = JSON.parse(props.event.content)
    // 提取 responseData 字段（如果存在）
    const data = parsed.responseData || parsed
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  } catch {
    return props.event.content
  }
})
</script>

<template>
  <div
    class="msg-row"
    :class="{
      'is-user': isUser,
      'is-ai': !isUser && event.type === 'CONTENT',
      'is-reasoning': event.type === 'REASONING',
      'is-tool': event.type === 'TOOL_CALL' || event.type === 'TOOL_CONTENT',
      'is-status': event.type === 'STATUS',
      'is-error': event.type === 'ERROR'
    }"
  >
    <!-- AI 头像（左侧） -->
    <div v-if="!isUser" class="msg-avatar">
      <span>{{ config.icon }}</span>
    </div>

    <!-- 空白占位（用户消息右侧头像用） -->
    <div v-else class="avatar-spacer"></div>

    <!-- 气泡 -->
    <div class="msg-bubble">
      <!-- TOOL_CONTENT：以纯文本方式显示解析后的内容 -->
      <div v-if="event.type === 'TOOL_CONTENT' && toolDisplayText" class="msg-content msg-tool-content">{{ toolDisplayText }}</div>
      <!-- 其他类型用 markdown -->
      <div v-else-if="event.content" class="msg-content" v-html="renderedContent"></div>
      <div v-if="event.error" class="msg-error-block">
        <span>⚠ {{ event.error }}</span>
      </div>
    </div>

    <!-- 用户头像（右侧） -->
    <div v-if="isUser" class="msg-avatar user-avatar">
      <span>{{ config.icon }}</span>
    </div>
    <div v-else class="avatar-spacer"></div>
  </div>
</template>

<style scoped>
.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
  animation: msgIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
}

@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
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
  font-size: 14px;
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
.msg-bubble {
  max-width: 75%;
  min-width: 0;
  position: relative;
}

/* 用户气泡 - 浅卡片底色 */
.is-user .msg-bubble {
  background: var(--bg-elevated);
  border: 1px solid var(--border-glass);
  color: var(--text-primary);
  border-radius: 18px 18px 4px 18px;
  padding: 10px 16px;
  box-shadow: var(--shadow-sm);
  margin-left: auto;
}

.is-user .msg-content {
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-word;
  font-size: 14px;
  overflow-wrap: break-word;
}

/* AI 气泡 - 左对齐玻璃 */
.is-ai .msg-bubble {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-glass);
  border-radius: 4px 18px 18px 18px;
  padding: 10px 16px;
}

.is-ai .msg-content {
  color: var(--text-primary);
  line-height: 1.7;
  word-break: break-word;
  font-size: 14px;
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
  max-width: 85%;
}

.is-tool .msg-content {
  font-family: var(--font-code);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* TOOL_CONTENT 结果区：更紧凑的代码式展示 */
.msg-tool-content {
  max-height: 240px;
  overflow-y: auto;
  scrollbar-width: thin;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-tertiary);
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

.msg-error-block {
  color: #f87171;
  font-size: 13px;
  line-height: 1.6;
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
}

.msg-bubble {
  min-width: 0; /* allow child shrink below content width */
}

.msg-content {
  min-width: 0;
  overflow-wrap: break-word;
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

.msg-content :deep(a) {
  text-decoration: underline;
  transition: opacity 0.2s;
}

.is-user .msg-content :deep(a) { color: #c7d2fe; }
.is-user .msg-content :deep(a:hover) { opacity: 0.8; }
.is-ai .msg-content :deep(a) { color: var(--accent-primary); }
.is-ai .msg-content :deep(a:hover) { color: var(--accent-secondary); }

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
