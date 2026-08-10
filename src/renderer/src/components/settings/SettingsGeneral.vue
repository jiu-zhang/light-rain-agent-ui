<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  getThemeMode,
  setThemeMode,
  getAiParams,
  setAiParams,
  getChatPrefs,
  setChatPrefs,
  getCustomThemeVars,
  setCustomThemeVar,
  resetCustomTheme,
  type ThemeMode
} from '@renderer/utils'
import Icon, { type IconName } from '@renderer/components/common/Icon.vue'
import ColorPicker from '@renderer/components/common/ColorPicker.vue'

const themeMode = ref<ThemeMode>(getThemeMode())
const aiParams = ref(getAiParams())
const chatPrefs = ref(getChatPrefs())

watch(aiParams, () => setAiParams(aiParams.value), { deep: true })
watch(chatPrefs, () => setChatPrefs({ ...chatPrefs.value }), { deep: true })

function applyTheme(mode: ThemeMode): void {
  themeMode.value = mode
  setThemeMode(mode)
}

const themeOptions: {
  mode: ThemeMode
  icon: IconName
  label: string
  desc: string
  colors: string
}[] = [
  {
    mode: 'light',
    icon: 'sun',
    label: '浅色',
    desc: '明亮清爽',
    colors: 'linear-gradient(135deg, #fef3c7, #fde68a, #fbbf24)'
  },
  {
    mode: 'dark',
    icon: 'moon',
    label: '深色',
    desc: '护眼沉浸',
    colors: 'linear-gradient(135deg, #312e81, #4338ca, #6366f1)'
  },
  {
    mode: 'system',
    icon: 'monitor',
    label: '跟随系统',
    desc: '自动切换',
    colors: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)'
  },
  {
    mode: 'custom',
    icon: 'palette',
    label: '自定义',
    desc: '个性化配色',
    colors: 'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6)'
  }
]

const customThemeVars = ref(getCustomThemeVars())

const defaultCustomVars = {
  primaryColor: '#60a5fa',
  successColor: '#22c55e',
  errorColor: '#ef4444',
  warningColor: '#f59e0b'
}

/** 更新自定义主题变量 */
function updateCustomVar(key: string, value: string): void {
  setCustomThemeVar(key, value)
  customThemeVars.value = getCustomThemeVars()
}

/** 重置自定义主题 */
function handleResetCustomTheme(): void {
  resetCustomTheme()
  customThemeVars.value = {}
  if (themeMode.value === 'custom') {
    applyTheme('dark') // 重置后切换到深色主题
  }
}
</script>

<template>
  <div class="section-block">
    <div class="section-label">
      <Icon name="palette" :size="12" />
      主题外观
    </div>
    <div class="theme-options">
      <button
        v-for="opt in themeOptions"
        :key="opt.mode"
        class="theme-card"
        :class="{ active: themeMode === opt.mode }"
        @click="applyTheme(opt.mode)"
      >
        <div class="theme-preview" :style="{ background: opt.colors }">
          <Icon :name="opt.icon" :size="20" class="preview-icon" />
        </div>
        <div class="theme-info">
          <span class="theme-name">{{ opt.label }}</span>
          <span class="theme-desc">{{ opt.desc }}</span>
        </div>
        <div v-if="themeMode === opt.mode" class="check-mark">
          <Icon name="check" :size="10" />
        </div>
      </button>
    </div>

    <!-- 自定义主题配置面板 -->
    <div v-if="themeMode === 'custom'" class="custom-theme-panel">
      <div class="section-label">自定义主题配色</div>
      <div class="color-control-list">
        <div class="color-control-group">
          <label class="color-control-label">主色调</label>
          <ColorPicker
            label="主色调"
            :model-value="customThemeVars['--accent-primary'] || defaultCustomVars.primaryColor"
            @update:model-value="(val) => updateCustomVar('--accent-primary', val)"
          />
        </div>
        <div class="color-control-group">
          <label class="color-control-label">成功</label>
          <ColorPicker
            label="成功色"
            :model-value="customThemeVars['--accent-success'] || defaultCustomVars.successColor"
            @update:model-value="(val) => updateCustomVar('--accent-success', val)"
          />
        </div>
        <div class="color-control-group">
          <label class="color-control-label">错误</label>
          <ColorPicker
            label="错误色"
            :model-value="customThemeVars['--accent-error'] || defaultCustomVars.errorColor"
            @update:model-value="(val) => updateCustomVar('--accent-error', val)"
          />
        </div>
        <div class="color-control-group">
          <label class="color-control-label">警告</label>
          <ColorPicker
            label="警告色"
            :model-value="customThemeVars['--accent-warning'] || defaultCustomVars.warningColor"
            @update:model-value="(val) => updateCustomVar('--accent-warning', val)"
          />
        </div>
      </div>
      <button class="reset-btn" @click="handleResetCustomTheme">
        <Icon name="refresh" :size="14" />
        重置自定义主题
      </button>
    </div>
  </div>

  <div class="section-block">
    <div class="section-label">聊天显示</div>
    <div class="pref-row">
      <div class="pref-info">
        <div class="pref-name">消息密度</div>
        <div class="pref-desc">控制消息之间的间距</div>
      </div>
      <select v-model="chatPrefs.density" class="pref-select">
        <option value="comfortable">舒适</option>
        <option value="compact">紧凑</option>
      </select>
    </div>
    <div class="pref-row">
      <div class="pref-info">
        <div class="pref-name">消息字号</div>
        <div class="pref-desc">控制对话内容的字体大小</div>
      </div>
      <select v-model="chatPrefs.fontSize" class="pref-select">
        <option value="small">小</option>
        <option value="medium">中</option>
        <option value="large">大</option>
      </select>
    </div>
  </div>

  <div class="section-block">
    <div class="section-label">系统提示词</div>
    <textarea
      v-model="aiParams.systemPrompt"
      class="prompt-textarea"
      rows="4"
      placeholder="设置 AI 助手的角色和行为方式，例如：你是一个专业的编程助手..."
    />
  </div>

  <div class="section-block">
    <div class="section-label">
      <Icon name="bot" :size="12" />
      AI 参数
    </div>
    <div class="ai-params">
      <div class="param-row">
        <div class="param-info">
          <div class="param-name">温度 (Temperature)</div>
          <div class="param-desc">控制输出随机性，越高越有创意</div>
        </div>
        <div class="param-control">
          <input v-model.number="aiParams.temperature" type="range" min="0" max="2" step="0.1" />
          <span class="param-value">{{ aiParams.temperature }}</span>
        </div>
      </div>
      <div class="param-row">
        <div class="param-info">
          <div class="param-name">最大 Token 数</div>
          <div class="param-desc">限制单次回复最大长度</div>
        </div>
        <div class="param-control">
          <input
            v-model.number="aiParams.maxTokens"
            type="number"
            min="256"
            max="128000"
            step="1"
            class="param-input"
          />
        </div>
      </div>
      <div class="param-row">
        <div class="param-info">
          <div class="param-name">Top-P 采样</div>
          <div class="param-desc">核采样概率阈值</div>
        </div>
        <div class="param-control">
          <input v-model.number="aiParams.topP" type="range" min="0" max="1" step="0.05" />
          <span class="param-value">{{ aiParams.topP }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-block {
  margin-bottom: 28px;
}
.section-block:last-child {
  margin-bottom: 0;
}
.prompt-textarea {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  min-height: 100px;
  font-family: inherit;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.prompt-textarea:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 12%, transparent);
}
.prompt-textarea::placeholder {
  color: var(--text-quaternary);
}
.theme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px 12px;
  background: var(--bg-tertiary);
  border: 2px solid transparent;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--text-primary);
}
.theme-card:hover {
  border-color: var(--border-hover);
}
.theme-card.active {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 6%, transparent);
}
.theme-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-fast);
}
.theme-card:hover .theme-preview {
  transform: scale(1.05);
}
.preview-icon {
  color: white;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.theme-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.theme-name {
  font-size: 12px;
  font-weight: 600;
}
.theme-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}
.check-mark {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  background: var(--accent-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

/* 自定义主题面板 */
.custom-theme-panel {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  animation: slideDown 0.2s ease-out;
}

.color-control-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 16px;
  margin-bottom: 12px;
}

.color-control-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.color-control-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.ai-params {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.param-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  gap: 16px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.param-row:hover {
  background: var(--bg-hover);
  border-color: var(--border-accent);
}
.param-info {
  flex: 1;
  min-width: 0;
}
.param-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.param-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}
.param-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.param-control input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100px;
  height: 5px;
  border-radius: 999px;
  background: var(--bg-quaternary);
  outline: none;
  cursor: pointer;
}
.param-control input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
}
.param-value {
  min-width: 32px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-code);
  padding: 2px 8px;
  background: var(--bg-quaternary);
  border-radius: 6px;
}
.param-input {
  width: 100px;
  padding: 6px 10px;
  background: var(--bg-quaternary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-code);
  text-align: center;
  outline: none;
}
.param-input:focus {
  outline: none;
}
.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  gap: 16px;
  margin-bottom: 12px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.pref-row:hover {
  background: var(--bg-hover);
  border-color: var(--border-accent);
}
.pref-info {
  flex: 1;
  min-width: 0;
}
.pref-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.pref-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}
.pref-select {
  padding: 8px 14px;
  background: var(--bg-quaternary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.pref-select:hover {
  border-color: var(--border-accent);
}
</style>
