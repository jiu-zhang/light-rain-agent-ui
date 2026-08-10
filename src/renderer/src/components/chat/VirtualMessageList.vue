<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { ChatTurn } from '@renderer/types'
import ChatMessage from './ChatMessage.vue'

interface Props {
  messages: ChatTurn[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'regenerate', turnId: string): void
  (e: 'scroll', event: Event): void
}>()

const containerRef = ref<HTMLElement | null>(null)
/**
 * 是否锚定在底部：新消息/流式输出时自动跟随到底部，用户主动向上滚动即取消。
 * 使用浏览器原生滚动（content-visibility 虚拟化），scrollHeight 由浏览器维护，
 * 无需自研高度表/offsetY，彻底避免滚动位置被重算导致的跳动。
 */
let pinBottom = false

/** 底部锚定阈值：滚动位置距离底部小于该值视为"贴底" */
const FOLLOW_THRESHOLD = 80

function handleScroll(e: Event): void {
  const target = e.target as HTMLElement
  // 双向判定：离开底部 → 停止跟随；回到底部附近 → 恢复跟随（QQ 式交互）
  pinBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - FOLLOW_THRESHOLD
  emit('scroll', e)
}

// 消息列表引用变化（流式 content 更新 / 新回合追加 / 历史加载）时，
// 若仍锚定在底部则跟随滚动到底部；turns 由父组件按消息内容重建，
// AI 回合的 content 在 events 内，故监听整个数组引用而非单个字段。
watch(
  () => props.messages,
  () => {
    const el = containerRef.value
    if (!el || !pinBottom) return
    nextTick(() => {
      el.scrollTop = el.scrollHeight
    })
  }
)

// ─── 暴露给父组件（兼容原生滚动容器调用方式） ─────────
function scrollTo(options: {
  top?: number
  left?: number
  behavior?: 'auto' | 'instant' | 'smooth'
}): void {
  containerRef.value?.scrollTo(options)
}

function scrollToBottom(): void {
  pinBottom = true
  const el = containerRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  // 等图片/代码高亮等异步布局稳定后再次到底
  nextTick(() => {
    const c = containerRef.value
    if (c) c.scrollTop = c.scrollHeight
    requestAnimationFrame(() => {
      const cc = containerRef.value
      if (cc) cc.scrollTop = cc.scrollHeight
    })
  })
}

/** 滚动到指定消息（目录跳转）：消息已全部渲染，直接定位到对应元素 */
function scrollToMessage(uid: string): void {
  const el = containerRef.value
  if (!el) return
  const target = el.querySelector<HTMLElement>(`[data-uid="${uid}"]`)
  if (!target) return
  el.scrollTo({ top: Math.max(0, target.offsetTop - 70), behavior: 'smooth' })
  pinBottom = false
}

defineExpose({
  scrollTo,
  scrollToBottom,
  scrollToMessage,
  get scrollTop(): number {
    return containerRef.value?.scrollTop ?? 0
  },
  set scrollTop(v: number) {
    if (containerRef.value) containerRef.value.scrollTop = v
  },
  get scrollHeight(): number {
    return containerRef.value?.scrollHeight ?? 0
  },
  get clientHeight(): number {
    return containerRef.value?.clientHeight ?? 0
  },
  getBoundingClientRect() {
    return containerRef.value?.getBoundingClientRect() ?? null
  },
  querySelector(sel: string) {
    return containerRef.value?.querySelector(sel) ?? null
  }
})
</script>

<template>
  <div ref="containerRef" class="virtual-message-list" @scroll="handleScroll">
    <div v-for="item in props.messages" :key="item.uid" class="virtual-item">
      <ChatMessage
        :turn="item"
        :streaming="item.streaming"
        @regenerate="emit('regenerate', item.uid)"
      />
    </div>
  </div>
</template>

<style scoped>
.virtual-message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  position: relative;
  scrollbar-width: none;
}
.virtual-message-list::-webkit-scrollbar {
  display: none;
}
/* 浏览器原生虚拟化：屏幕外的消息跳过布局/绘制，大幅降低长列表渲染开销；
   scrollHeight 由浏览器按估算尺寸维护，滚动行为与普通列表一致 */
.virtual-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 120px;
}
</style>
