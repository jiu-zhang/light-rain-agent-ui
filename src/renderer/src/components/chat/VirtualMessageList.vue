<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
const scrollTop = ref(0)
/** 是否锚定在底部：高度测量变化时持续回到底部，用户主动上滑即取消 */
let pinBottom = false

// ─── 动态高度虚拟滚动 ────────────────────────────────
const ESTIMATE = 160
const OVERSCAN = 480

/** 每条消息的已测量高度（未测量时用估算值） */
const heights = ref<number[]>([])
const visibleStart = ref(0)
const visibleEnd = ref(0)
const itemEls = new Map<number, HTMLElement>()
const observers = new Map<number, ResizeObserver>()

const count = computed(() => props.messages.length)

function ensureHeights(n: number): void {
  const h = heights.value
  if (h.length === n) return
  if (h.length > n) {
    heights.value = h.slice(0, n)
    return
  }
  heights.value = [...h, ...new Array<number>(n - h.length).fill(ESTIMATE)]
}

/** 前缀和：offsets[i] = 第 i 条消息顶部相对列表起点的偏移 */
function prefixSums(): number[] {
  const h = heights.value
  const sums = new Array<number>(h.length)
  let acc = 0
  for (let i = 0; i < h.length; i++) {
    sums[i] = acc
    acc += h[i]
  }
  return sums
}

/** 根据滚动位置计算可见区间 */
function updateVisibleRange(): void {
  const n = count.value
  if (n === 0) {
    visibleStart.value = 0
    visibleEnd.value = 0
    return
  }
  ensureHeights(n)
  const sums = prefixSums()
  const containerH = containerRef.value?.clientHeight ?? 0
  const top = Math.max(0, scrollTop.value - OVERSCAN)
  const bottom = scrollTop.value + containerH + OVERSCAN

  // 起始项：二分查找第一个偏移区间覆盖 top 的项
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sums[mid] + heights.value[mid] <= top) lo = mid + 1
    else hi = mid
  }
  const start = lo

  // 结束项：从起始项起累加高度，直到覆盖 bottom
  let end = start
  let acc = sums[start]
  while (end < n && acc < bottom) {
    acc += heights.value[end]
    end++
  }

  visibleStart.value = start
  visibleEnd.value = Math.min(n, end)
}

const totalHeight = computed(() => heights.value.reduce((a, b) => a + b, 0))

const offsetY = computed(() => {
  const h = heights.value
  let acc = 0
  for (let i = 0; i < visibleStart.value && i < h.length; i++) acc += h[i]
  return acc
})

const visibleItems = computed(() => {
  const list: { msg: ChatTurn; index: number }[] = []
  for (let i = visibleStart.value; i < visibleEnd.value; i++) {
    if (i < props.messages.length) list.push({ msg: props.messages[i], index: i })
  }
  return list
})

function handleScroll(e: Event): void {
  const target = e.target as HTMLElement
  scrollTop.value = target.scrollTop
  if (target.scrollTop + target.clientHeight < target.scrollHeight - 80) {
    pinBottom = false
  }
  updateVisibleRange()
  emit('scroll', e)
}

/** 测量单项高度并同步高度表 */
function measureItem(index: number): void {
  const el = itemEls.get(index)
  if (!el) return
  const h = el.getBoundingClientRect().height || ESTIMATE
  if (Math.abs(heights.value[index] - h) > 1) {
    heights.value[index] = h
    updateVisibleRange()
    if (pinBottom) {
      nextTick(() => {
        const c = containerRef.value
        if (c) c.scrollTop = c.scrollHeight
      })
    }
  }
}

/** 挂载/卸载单项时的 ref 回调（index 为消息全局序号） */
function setItemRef(el: unknown, index: number): void {
  const dom = el instanceof HTMLElement ? el : null
  if (!dom) {
    itemEls.delete(index)
    const obs = observers.get(index)
    if (obs) {
      obs.disconnect()
      observers.delete(index)
    }
    return
  }
  itemEls.set(index, dom)
  const prev = observers.get(index)
  if (prev) prev.disconnect()
  const obs = new ResizeObserver(() => measureItem(index))
  obs.observe(dom)
  observers.set(index, obs)
  measureItem(index)
}

function setItemRefFor(index: number): (el: unknown) => void {
  return (el: unknown) => setItemRef(el, index)
}

// 消息数量变化时重建高度表
watch(count, (n) => {
  if (n === 0) {
    heights.value = []
    scrollTop.value = 0
    visibleStart.value = 0
    visibleEnd.value = 0
    return
  }
  ensureHeights(n)
  nextTick(() => updateVisibleRange())
})

// 最后一条消息在流式输出时自动跟随到底部（贴近底部才跟随）
watch(
  () => {
    const last = props.messages[props.messages.length - 1]
    return last?.streaming ? last.content : undefined
  },
  () => {
    const el = containerRef.value
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      pinBottom = true
      nextTick(() => {
        const c = containerRef.value
        if (c) c.scrollTop = c.scrollHeight
      })
    }
  }
)

onMounted(() => {
  updateVisibleRange()
})

onBeforeUnmount(() => {
  for (const obs of observers.values()) obs.disconnect()
  observers.clear()
  itemEls.clear()
})

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
  // 同步先滚一次：让父组件紧接着读 scrollTop/scrollHeight 时能拿到正确值，
  // 避免父组件的 onMessagesScroll/loadOlderIfAtTop 误判「已在顶部」而触发加载更早消息
  const el = containerRef.value
  if (el) el.scrollTop = el.scrollHeight
  nextTick(() => {
    const c = containerRef.value
    if (c) c.scrollTop = c.scrollHeight
    // 等高度测量稳定后再次到底，避免流式最后一条高度未测量导致不到位
    requestAnimationFrame(() => {
      const cc = containerRef.value
      if (cc) cc.scrollTop = cc.scrollHeight
    })
  })
}

/** 滚动到指定消息（目录跳转）：未渲染的消息按高度表估算偏移 */
function scrollToMessage(uid: string): void {
  const idx = props.messages.findIndex((m) => m.uid === uid)
  if (idx < 0) return
  let offset = 0
  for (let i = 0; i < idx; i++) offset += heights.value[i] ?? ESTIMATE
  const el = containerRef.value
  if (!el) return
  el.scrollTo({ top: Math.max(0, offset - 70), behavior: 'smooth' })
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
    <div class="virtual-list-spacer" :style="{ height: totalHeight + 'px' }">
      <div class="virtual-list-content" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="item in visibleItems"
          :key="item.msg.uid"
          :ref="setItemRefFor(item.index)"
          class="virtual-item"
        >
          <ChatMessage
            :turn="item.msg"
            :streaming="item.msg.streaming"
            @regenerate="emit('regenerate', item.msg.uid)"
          />
        </div>
      </div>
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
.virtual-list-spacer {
  position: relative;
}
.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
.virtual-item {
  contain: layout style;
}
</style>
