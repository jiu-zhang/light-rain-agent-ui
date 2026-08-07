<script setup lang="ts">
import Icon, { type IconName } from '@renderer/components/common/Icon.vue'
import MarkdownContent from './MarkdownContent.vue'
import type { ChatEvent } from '@renderer/types'

const props = defineProps<{
  /** 工具事件（TOOL_CALL 或 TOOL_CONTENT） */
  evt: ChatEvent
  /** 卡片类型：调用中 / 结果 */
  kind: 'call' | 'result'
  /** 是否展开参数/结果详情 */
  open: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

/** 工具调用信息（TOOL_CALL） */
function toolCallInfo(evt: ChatEvent): { name: string; args: string } | null {
  if (!evt.content) return null
  try {
    const p = JSON.parse(evt.content)
    const args = p.arguments
    const argsText = typeof args === 'string' ? args : args ? JSON.stringify(args, null, 2) : ''
    return { name: p.name || 'tool', args: argsText }
  } catch {
    return null
  }
}

/** 工具结果信息（TOOL_CONTENT） */
function toolContentInfo(evt: ChatEvent): { name: string; result: string } | null {
  if (!evt.content) return null
  try {
    const p = JSON.parse(evt.content)
    const data = p.responseData !== undefined ? p.responseData : p
    let text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    // 部分工具返回值经 Spring AI 包装后本身是 JSON 字符串（首尾带引号），剥掉一层避免显示多余引号
    if (typeof text === 'string' && text.startsWith('"') && text.endsWith('"')) {
      try {
        const decoded = JSON.parse(text)
        if (typeof decoded === 'string') text = decoded
      } catch {
        // 非 JSON 字符串，保持原样
      }
    }
    return { name: p.name || 'tool', result: text }
  } catch {
    return null
  }
}

const header = (): { title: string; icon: IconName; detail: string } => {
  if (props.kind === 'call') {
    const info = toolCallInfo(props.evt)
    return {
      title: info?.name ?? '工具调用',
      icon: 'zap',
      detail: info?.args ?? props.evt.content ?? ''
    }
  }
  const info = toolContentInfo(props.evt)
  return {
    title: info?.name ?? '工具结果',
    icon: 'check',
    detail: info?.result ?? props.evt.content ?? ''
  }
}

/**
 * 判断工具结果是否为结构化 markdown：
 * 仅当内容包含 markdown 特征（标题/表格/加粗/列表/代码块）时走 Markdown 渲染，
 * 否则（纯文本文件列表、命令输出、JSON 等）保持 <pre> 原样，避免 `---` 变分隔线、
 * 文件名列表被误解析成段落。
 */
function isMarkdownLike(text: string): boolean {
  return (
    /(^|\n)\s{0,3}#{1,6}\s|\|.*\|/m.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /(^|\n)\s{0,3}([-*+]|\d+[.)])\s/.test(text) ||
    /(^|\n)```/.test(text)
  )
}
</script>

<template>
  <div class="tool-card" :class="kind === 'call' ? 'is-call' : 'is-result'">
    <div class="tool-card-header" @click="emit('toggle')">
      <span class="tool-ic"><Icon :name="header().icon" :size="13" /></span>
      <span class="tool-name">{{ header().title }}</span>
      <span class="tool-status" :class="{ done: kind === 'result' }">
        <Icon v-if="kind === 'call'" name="loader" :size="11" class="tool-spin" />
        {{ kind === 'call' ? '调用中' : '已完成' }}
      </span>
      <Icon name="chevron-down" :size="13" class="tool-arrow" :class="{ open }" />
    </div>
    <div v-if="open" class="tool-detail">
      <!-- 结构化 markdown 结果走 MarkdownContent；纯文本/命令输出/JSON 保持 <pre> 原样 -->
      <MarkdownContent
        v-if="kind === 'result' && isMarkdownLike(header().detail)"
        :content="header().detail"
        class="tool-detail-md"
      />
      <pre v-else>{{ header().detail }}</pre>
    </div>
  </div>
</template>

<style scoped>
.tool-card {
  margin-bottom: 8px;
  border-radius: 10px;
  overflow: hidden;
  max-width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-left-width: 3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.tool-card.is-call {
  border-left-color: #f59e0b;
}

.tool-card.is-result {
  border-left-color: #22c55e;
}

.tool-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.tool-card-header:hover {
  background: rgba(255, 255, 255, 0.03);
}

.tool-ic {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.tool-card.is-result .tool-ic {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
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

.tool-status {
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #f59e0b;
}

.tool-status.done {
  color: #22c55e;
}

.tool-spin {
  animation: spin 0.9s linear infinite;
}

.tool-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: transform 0.25s ease;
}

.tool-arrow.open {
  transform: rotate(180deg);
}

.tool-detail {
  padding: 0 12px 10px;
}

.tool-detail-md {
  max-height: 240px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.25);
}

.tool-detail pre {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  max-height: 240px;
  overflow: auto;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: rgba(0, 0, 0, 0.25);
  font-family: var(--font-code);
  white-space: pre-wrap;
  word-break: break-all;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
