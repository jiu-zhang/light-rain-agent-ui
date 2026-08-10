<script setup lang="ts">
import Icon from '@renderer/components/common/Icon.vue'

defineProps<{
  show: boolean
  agentMode: boolean
  planMode: boolean
  deepThink: boolean
  supportsDeepThink: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'toggle-agent': []
  'toggle-plan': []
  'toggle-think': []
}>()

function toggleAgent(): void {
  emit('toggle-agent')
}

function togglePlan(): void {
  emit('toggle-plan')
}

function toggleThink(): void {
  emit('toggle-think')
}
</script>

<template>
  <div class="mode-wrap">
    <button
      class="command-btn mode-btn"
      :class="{ lit: agentMode || planMode || (deepThink && supportsDeepThink), open: show }"
      title="智能模式：智能体 / 计划 / 深度思考"
      @click.stop="emit('update:show', !show)"
    >
      <Icon name="sparkles" :size="15" class="mode-icon" />
      <span class="mode-label">模式</span>
      <span v-if="agentMode || planMode || (deepThink && supportsDeepThink)" class="mode-badge">
        {{ [agentMode, planMode, deepThink && supportsDeepThink].filter(Boolean).length }}
      </span>
      <Icon name="chevron-down" :size="12" class="mode-arrow" />
    </button>

    <!-- 智能模式弹层 -->
    <Transition name="pop">
      <div v-if="show" class="mode-popover" @click.stop>
        <div class="mode-popover-accent" />
        <div class="mode-popover-title">
          <Icon name="sparkles" :size="13" />
          <span>智能模式</span>
        </div>
        <div class="mode-row" @click="toggleAgent">
          <div class="mode-row-icon agent"><Icon name="bot" :size="15" /></div>
          <div class="mode-row-text">
            <div class="mode-row-name">智能体模式</div>
            <div class="mode-row-desc">调用工具自动化完成任务</div>
          </div>
          <button class="mode-switch" :class="{ on: agentMode }" type="button">
            <span />
          </button>
        </div>
        <div class="mode-row" @click="togglePlan">
          <div class="mode-row-icon plan"><Icon name="git-branch" :size="15" /></div>
          <div class="mode-row-text">
            <div class="mode-row-name">计划模式</div>
            <div class="mode-row-desc">按计划拆分步骤逐步执行</div>
          </div>
          <button class="mode-switch" :class="{ on: planMode }" type="button">
            <span />
          </button>
        </div>
        <div v-if="supportsDeepThink" class="mode-row" @click="toggleThink">
          <div class="mode-row-icon think"><Icon name="brain" :size="15" /></div>
          <div class="mode-row-text">
            <div class="mode-row-name">深度思考</div>
            <div class="mode-row-desc">模型先深入思考再回答</div>
          </div>
          <button class="mode-switch" :class="{ on: deepThink }" type="button">
            <span />
          </button>
        </div>
        <div class="mode-hint">
          <span class="hint-kbd">Enter</span> 发送
          <span class="hint-sep">·</span>
          <span class="hint-kbd">Shift+Enter</span> 换行
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
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
.mode-wrap {
  position: relative;
  display: flex;
}
.mode-btn {
  gap: 5px;
}
.mode-btn .mode-icon {
  color: var(--text-tertiary);
  transition: all 0.2s;
}
.mode-btn:hover .mode-icon {
  color: var(--accent-primary);
}
.mode-btn.lit {
  color: var(--accent-primary);
  border-color: var(--border-accent);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  box-shadow: 0 0 16px rgba(96, 165, 250, 0.18);
}
.mode-btn.lit .mode-icon {
  color: var(--accent-primary);
}
.mode-btn.open {
  color: var(--accent-primary);
  border-color: var(--border-accent);
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
}
.mode-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: linear-gradient(135deg, #60a5fa, #8b5cf6);
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.mode-arrow {
  color: var(--text-quaternary);
  transition: transform 0.2s;
}
.mode-btn.open .mode-arrow {
  transform: rotate(180deg);
}

/* 智能模式弹层 */
.mode-popover {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  width: 280px;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  backdrop-filter: blur(28px) saturate(1.4);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  padding: 10px;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(96, 165, 250, 0.08) inset;
  z-index: 100;
  overflow: hidden;
}
.mode-popover-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #60a5fa, #8b5cf6, #34d399);
  opacity: 0.9;
}
.mode-popover-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  text-transform: uppercase;
}
.mode-popover-title .icon {
  color: var(--accent-primary);
}
.mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.mode-row:hover {
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}
.mode-row-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.mode-row-icon.agent {
  background: color-mix(in srgb, var(--accent-success) 14%, transparent);
  color: var(--accent-success);
}
.mode-row-icon.plan {
  background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
  color: var(--accent-primary);
}
.mode-row-icon.think {
  background: color-mix(in srgb, #a78bfa 18%, transparent);
  color: #a78bfa;
}
.mode-row-text {
  flex: 1;
  min-width: 0;
}
.mode-row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.mode-row-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 1px;
}
.mode-switch {
  position: relative;
  width: 34px;
  height: 19px;
  border: none;
  border-radius: 999px;
  background: var(--bg-quaternary);
  cursor: pointer;
  transition: background 0.25s;
  flex-shrink: 0;
  padding: 0;
}
.mode-switch span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mode-switch.on {
  background: linear-gradient(135deg, #60a5fa, #8b5cf6);
  box-shadow: 0 0 12px rgba(96, 165, 250, 0.4);
}
.mode-switch.on span {
  transform: translateX(15px);
  background: white;
  box-shadow: 0 2px 6px rgba(96, 165, 250, 0.5);
}
.mode-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 6px 2px;
  font-size: 11px;
  color: var(--text-quaternary);
}
.mode-hint .hint-sep {
  margin: 0 2px;
}
.hint-kbd {
  padding: 1px 5px;
  background: var(--bg-glass);
  border-radius: 4px;
  font-family: var(--font-code);
  font-size: 10px;
  color: var(--text-tertiary);
}

/* 弹层过渡动画 */
.pop-enter-active,
.pop-leave-active {
  transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}
</style>
