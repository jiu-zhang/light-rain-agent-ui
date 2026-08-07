<script setup lang="ts">
import Icon from '@renderer/components/common/Icon.vue'
import MarkdownContent from './MarkdownContent.vue'

defineProps<{
  /** 事件 uid（用于定位展开状态） */
  uid: string
  /** 思考内容 */
  content: string
  /** 是否正在流式输出 */
  streaming?: boolean
  /** 当前是否展开 */
  open?: boolean
  /** 思考计时（秒），流式中实时递增、完成后定格 */
  elapsed: number
}>()

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <div class="reasoning-block" :class="{ 'is-streaming': !!streaming }">
    <button class="reasoning-header" type="button" @click="emit('toggle')">
      <span class="reasoning-ic"><Icon name="brain" :size="14" /></span>
      <span class="reasoning-label">
        {{ !!streaming ? '思考中' : '深度思考' }}
        <span v-if="!!streaming" class="reasoning-dot" />
      </span>
      <span v-if="elapsed > 0" class="reasoning-duration">
        {{ !!streaming ? `${elapsed}s` : `用时 ${elapsed} 秒` }}
      </span>
      <span class="reasoning-toggle">{{ !!open ? '收起' : '展开' }}</span>
      <Icon name="chevron-down" :size="13" class="reasoning-arrow" :class="{ open: !!open }" />
    </button>
    <div class="reasoning-body" :class="{ collapsed: !open }">
      <div class="reasoning-inner">
        <div class="reasoning-pad">
          <MarkdownContent :content="content" class="reasoning-content" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reasoning-block {
  margin-bottom: 10px;
  border: 1px solid rgba(167, 139, 250, 0.16);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.07), rgba(56, 189, 248, 0.04));
  overflow: hidden;
}

.reasoning-block.is-streaming {
  border-color: rgba(167, 139, 250, 0.28);
}

.reasoning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  user-select: none;
  color: var(--text-secondary);
  transition: background 0.2s ease;
}

.reasoning-header:hover {
  background: rgba(167, 139, 250, 0.08);
}

.reasoning-ic {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.16), rgba(56, 189, 248, 0.14));
  color: #a78bfa;
}

.reasoning-label {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-secondary);
}

.reasoning-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a78bfa;
  flex-shrink: 0;
  animation: reasoningPulse 1.2s ease-in-out infinite;
}

@keyframes reasoningPulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.4);
  }
  50% {
    opacity: 0.5;
    box-shadow: 0 0 0 5px rgba(167, 139, 250, 0);
  }
}

.reasoning-duration {
  font-size: 11px;
  font-family: var(--font-code);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.reasoning-toggle {
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.reasoning-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: transform 0.25s ease;
}

.reasoning-arrow.open {
  transform: rotate(180deg);
}

.reasoning-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.reasoning-body.collapsed {
  grid-template-rows: 0fr;
}

.reasoning-inner {
  overflow: hidden;
  min-height: 0;
}

.reasoning-pad {
  padding: 0 14px 12px;
}

.msg-content.reasoning-content {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
  border-left: 2px solid rgba(167, 139, 250, 0.28);
  padding-left: 12px;
}
</style>
