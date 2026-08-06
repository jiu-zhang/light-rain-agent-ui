<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiStore, MODE_OPTIONS } from '@renderer/stores'
import type { AppMode } from '@renderer/stores'
import Icon from '@renderer/components/common/Icon.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const navItems = [
  { path: '/', icon: 'chat', label: '对话' },
  { path: '/sessions', icon: 'history', label: '历史' },
  { path: '/models', icon: 'robot', label: '模型' },
  { path: '/mcp', icon: 'globe', label: 'MCP 服务器' },
  { path: '/cron', icon: 'clock', label: '定时任务' },
  { path: '/executions', icon: 'activity', label: '执行记录' },
  { path: '/plans', icon: 'git-branch', label: '计划模板' },
]

const bottomItems = computed(() => [
  { path: '/settings', icon: 'settings', label: '设置' }
])

/** 沉浸/专注模式：左缘热区 + 临时抽屉 */
const isHovering = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function handleMouseEnter(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  isHovering.value = true
}

function handleMouseLeave(): void {
  hideTimer = setTimeout(() => {
    isHovering.value = false
  }, 240)
}

function isActive(path: string): boolean {
  return route.path === path
}

function handleNavClick(path: string): void {
  router.push(path)
}

/** 模式选择器显隐控制 */
const showModeSwitcher = ref(false)
function toggleModeSwitcher(): void {
  showModeSwitcher.value = !showModeSwitcher.value
}

function selectMode(mode: AppMode): void {
  ui.setMode(mode)
  showModeSwitcher.value = false
}

const currentModeInfo = computed(
  () => MODE_OPTIONS.find((o) => o.value === ui.mode) ?? MODE_OPTIONS[0]
)

/** 哪些模式使用内嵌侧边栏（standard/minimal） */
const useInlineSidebar = computed(() => ui.mode === 'standard' || ui.mode === 'minimal')
/** 哪些模式使用悬浮抽屉（immersive/focus） */
const useDrawerSidebar = computed(() => ui.mode === 'immersive' || ui.mode === 'focus')
</script>

<template>
  <!-- ===== 内嵌侧边栏：standard / minimal ===== -->
  <nav v-if="useInlineSidebar" class="sidebar" :class="{ collapsed: ui.mode === 'minimal' }">
    <div class="sidebar-brand">
      <div class="brand-logo">
        <Icon name="sparkles" :size="20" />
      </div>
      <span v-show="ui.mode === 'standard'" class="sidebar-title">Light Rain</span>
    </div>

    <div class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="sidebar-item"
        :class="{ active: isActive(item.path) }"
        @click="handleNavClick(item.path)"
      >
        <Icon :name="item.icon as any" :size="18" class="item-icon" />
        <span v-show="ui.mode === 'standard'" class="item-label">{{ item.label }}</span>
        <span v-show="ui.mode === 'minimal'" class="item-tooltip">{{ item.label }}</span>
      </button>
    </div>

    <div class="sidebar-bottom">
      <!-- 模式切换器 -->
      <div class="mode-switcher">
        <button
          class="mode-current"
          :title="currentModeInfo.label + '模式'"
          @click="toggleModeSwitcher"
        >
          <Icon :name="currentModeInfo.icon as any" :size="16" />
          <span v-show="ui.mode === 'standard'" class="mode-label">{{ currentModeInfo.label }}</span>
          <Icon v-show="ui.mode === 'standard'" name="chevron-down" :size="10" class="mode-chevron" />
        </button>
        <Transition name="dropdown">
          <div v-if="showModeSwitcher" class="mode-dropdown" @click.stop>
            <button
              v-for="opt in MODE_OPTIONS"
              :key="opt.value"
              class="mode-option"
              :class="{ active: ui.mode === opt.value }"
              @click="selectMode(opt.value)"
            >
              <Icon :name="opt.icon as any" :size="14" />
              <div class="mode-option-info">
                <span class="mode-option-label">{{ opt.label }}</span>
                <span class="mode-option-desc">{{ opt.desc }}</span>
              </div>
              <Icon v-if="ui.mode === opt.value" name="check" :size="12" class="mode-check" />
            </button>
          </div>
        </Transition>
      </div>

      <button
        v-for="item in bottomItems"
        :key="item.label"
        class="sidebar-item"
        :class="{ active: isActive(item.path) }"
        @click="handleNavClick(item.path)"
      >
        <Icon :name="item.icon as any" :size="18" class="item-icon" />
        <span v-show="ui.mode === 'standard'" class="item-label">{{ item.label }}</span>
        <span v-show="ui.mode === 'minimal'" class="item-tooltip">{{ item.label }}</span>
      </button>
    </div>
  </nav>

  <!-- ===== 悬浮抽屉：immersive / focus ===== -->
  <template v-if="useDrawerSidebar">
    <div
      class="drawer-container"
      :class="{ 'is-hovering': isHovering }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <div class="drawer-hot-zone">
        <div class="hot-zone-indicator">
          <Icon name="chevron-right" :size="11" />
        </div>
      </div>
      <Transition name="drawer">
        <div v-if="isHovering" class="drawer-panel">
          <div class="sidebar-brand">
            <div class="brand-logo">
              <Icon name="sparkles" :size="20" />
            </div>
            <span class="sidebar-title">Light Rain</span>
          </div>
          <div class="sidebar-nav">
            <button
              v-for="item in navItems"
              :key="item.path"
              class="sidebar-item"
              :class="{ active: isActive(item.path) }"
              @click="handleNavClick(item.path)"
            >
              <Icon :name="item.icon as any" :size="18" class="item-icon" />
              <span class="item-label">{{ item.label }}</span>
            </button>
          </div>
          <div class="sidebar-bottom">
            <div class="mode-switcher">
              <button class="mode-current" @click="toggleModeSwitcher">
                <Icon :name="currentModeInfo.icon as any" :size="16" />
                <span class="mode-label">{{ currentModeInfo.label }}</span>
                <Icon name="chevron-down" :size="10" class="mode-chevron" />
              </button>
              <Transition name="dropdown">
                <div v-if="showModeSwitcher" class="mode-dropdown" @click.stop>
                  <button
                    v-for="opt in MODE_OPTIONS"
                    :key="opt.value"
                    class="mode-option"
                    :class="{ active: ui.mode === opt.value }"
                    @click="selectMode(opt.value)"
                  >
                    <Icon :name="opt.icon as any" :size="14" />
                    <div class="mode-option-info">
                      <span class="mode-option-label">{{ opt.label }}</span>
                      <span class="mode-option-desc">{{ opt.desc }}</span>
                    </div>
                    <Icon v-if="ui.mode === opt.value" name="check" :size="12" class="mode-check" />
                  </button>
                </div>
              </Transition>
            </div>
            <button
              v-for="item in bottomItems"
              :key="item.label"
              class="sidebar-item"
              :class="{ active: isActive(item.path) }"
              @click="handleNavClick(item.path)"
            >
              <Icon :name="item.icon as any" :size="18" class="item-icon" />
              <span class="item-label">{{ item.label }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </template>
</template>

<style scoped>
/* ===== 基础侧边栏 ===== */
.sidebar {
  width: 200px;
  flex-shrink: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 14px 10px;
  box-sizing: border-box;
  transition:
    width 0.25s var(--ease-out),
    transform 0.25s var(--ease-out);
}

.sidebar.collapsed {
  width: 56px;
  padding: 14px 6px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 18px;
}

.collapsed .sidebar-brand {
  justify-content: center;
  padding: 4px 0 18px;
}

.brand-logo {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--accent-gradient-tech);
  color: white;
  box-shadow: var(--glow-accent-sm);
  transition: box-shadow var(--transition-fast);
  flex-shrink: 0;
}

.brand-logo:hover {
  box-shadow: var(--glow-accent);
}

.sidebar-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  overflow: hidden;
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.sidebar-bottom {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

/* 导航项 */
.sidebar-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  overflow: hidden;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-instant);
}

.sidebar-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sidebar-item:hover .item-icon {
  color: var(--accent-secondary);
  transform: scale(1.08);
}

.sidebar-item:active {
  transform: scale(0.98);
}

.sidebar-item.active {
  background: var(--bg-active);
  color: var(--text-primary);
  font-weight: 600;
}

.sidebar-item.active .item-icon {
  color: var(--accent-primary);
}

/* 激活态指示条 */
.sidebar-item.active::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 22%;
  bottom: 22%;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent-gradient-tech);
  box-shadow: 0 0 8px rgba(var(--accent-primary-rgb), 0.6);
  animation: glowPulse 2.4s ease-out infinite;
}

.collapsed .sidebar-item.active::before {
  left: -6px;
}

.item-icon {
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: inherit;
  transition:
    color var(--transition-fast),
    transform var(--transition-fast);
}

.item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 极简模式 tooltip */
.item-tooltip {
  display: none;
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  padding: 5px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: var(--shadow-md);
  z-index: 50;
  animation: tooltipIn 0.15s var(--ease-out);
}

.collapsed .sidebar-item:hover .item-tooltip {
  display: block;
}

@keyframes tooltipIn {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
}

/* ===== 模式切换器 ===== */
.mode-switcher {
  position: relative;
  margin-bottom: 4px;
}

.mode-current {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
  font-family: inherit;
}

.mode-current:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.collapsed .mode-current {
  justify-content: center;
  padding: 9px 6px;
}

.mode-label {
  flex: 1;
  text-align: left;
}

.mode-chevron {
  transition: transform 0.2s;
}

/* 模式下拉 */
.mode-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  right: 0;
  padding: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-xl);
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collapsed .mode-dropdown {
  left: calc(100% + 8px);
  right: auto;
  min-width: 180px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
  font-family: inherit;
}

.mode-option:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.mode-option.active {
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: var(--accent-primary);
}

.mode-option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.mode-option-label {
  font-weight: 600;
  font-size: 13px;
}

.mode-option-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.mode-check {
  color: var(--accent-primary);
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s var(--ease-out),
    transform 0.15s var(--ease-out);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* ===== 悬浮抽屉（沉浸/专注） ===== */
.drawer-container {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 36px;
  z-index: 100;
  display: flex;
  flex-direction: row;
}

.drawer-hot-zone {
  width: 36px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  transition: opacity 0.18s var(--ease-out);
}

.hot-zone-indicator {
  width: 3px;
  height: 40px;
  background: var(--border-strong);
  border-radius: 2px;
  opacity: 0.4;
  transition: all 0.24s var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-quaternary);
}

.drawer-container.is-hovering .hot-zone-indicator {
  opacity: 1;
  background: var(--accent-gradient-tech);
  height: 56px;
  box-shadow: 0 0 12px rgba(var(--accent-primary-rgb), 0.6);
  color: var(--accent-primary);
}

/* 面板使用 absolute 覆盖热区，不留空白 */
.drawer-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 200px;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  padding: 14px 10px;
  box-sizing: border-box;
  box-shadow: var(--shadow-lg);
  z-index: 3;
}

/* 抽屉动画：面板从左侧滑入覆盖 */
.drawer-enter-active,
.drawer-leave-active {
  transition:
    transform 0.24s var(--ease-out),
    opacity 0.18s var(--ease-out);
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
</style>
