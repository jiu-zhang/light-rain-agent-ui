<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { closeOpenCodeBlock } from '@renderer/utils'

const props = withDefaults(
  defineProps<{
    /** markdown 原文 */
    content?: string
    /** 是否在末尾追加流式闪烁光标 */
    withCursor?: boolean
    /** 用户消息样式变体（默认 AI 样式） */
    isUser?: boolean
  }>(),
  { withCursor: false, isUser: false }
)

const rootRef = ref<HTMLElement | null>(null)

// 按内容缓存渲染结果，流式重渲染时避免重复解析相同内容；上限 200 条防内存膨胀
const renderCache = new Map<string, string>()
const MAX_RENDER_CACHE = 200

/**
 * 渲染 markdown 内容，流式输出时在末尾追加闪烁光标。
 * <p>DOMPurify 消毒 + 缓存复用，避免流式重渲染重复解析。
 * 流式期间（withCursor）每次内容都不同，缓存必然 miss 还会堆积中间态字符串，直接跳过缓存。</p>
 */
function renderMarkdown(content: string | undefined, withCursor: boolean): string {
  if (!content) return ''
  if (!withCursor) {
    const cached = renderCache.get(content)
    if (cached !== undefined) return cached
  }
  try {
    // 先补齐未闭合代码块，保证每次传给 marked 的都是结构完整的内容
    const sanitized = closeOpenCodeBlock(content)
    // marked 不提供净化能力，AI 输出可能携带恶意 HTML，渲染前必须用 DOMPurify 消毒
    const html = DOMPurify.sanitize(marked.parse(sanitized) as string)
    if (!withCursor) {
      if (renderCache.size >= MAX_RENDER_CACHE) renderCache.clear()
      renderCache.set(content, html)
    }
    return withCursor ? html + '<span class="stream-cursor"></span>' : html
  } catch {
    return content
  }
}

const html = computed(() => renderMarkdown(props.content, props.withCursor))

// 渲染完成后为代码块挂载"复制"按钮（幂等，流式更新不会重复添加）。
// immediate + flush post 保证静态历史消息在首帧渲染后也能挂载按钮。
function mountCopyButtons(): void {
  const root = rootRef.value
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
}

watch(html, mountCopyButtons, { flush: 'post' })
onMounted(mountCopyButtons)
</script>

<template>
  <!-- 内容已由 renderMarkdown 中的 DOMPurify.sanitize 消毒，此处 v-html 是安全的 -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div ref="rootRef" class="msg-content" :class="{ 'is-user': isUser }" v-html="html"></div>
</template>

<style scoped>
.msg-content {
  min-width: 0;
  overflow-wrap: break-word;
  color: var(--text-primary);
  line-height: 1.7;
  word-break: break-word;
  font-size: var(--chat-font-size, 14px);
}

.msg-content.is-user {
  line-height: 1.6;
}

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

.msg-content.is-user :deep(code) {
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

.msg-content.is-user :deep(pre) {
  background: rgba(0, 0, 0, 0.25);
}

.msg-content :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
}

.msg-content :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.msg-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

.msg-content :deep(a) {
  color: var(--accent-primary);
  text-decoration: underline;
  transition:
    opacity 0.2s,
    color 0.2s;
}

.msg-content :deep(a:hover) {
  color: var(--accent-secondary);
}

.msg-content.is-user :deep(a) {
  color: #c7d2fe;
}

.msg-content.is-user :deep(a:hover) {
  opacity: 0.8;
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

.msg-content.is-user :deep(h1),
.msg-content.is-user :deep(h2),
.msg-content.is-user :deep(h3),
.msg-content.is-user :deep(h4) {
  color: white;
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

@keyframes blink {
  50% {
    opacity: 0;
  }
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
</style>
