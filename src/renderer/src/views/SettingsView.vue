<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getThemeMode, setThemeMode, getAiParams, setAiParams, type ThemeMode } from '@renderer/utils'

declare const __APP_VERSION__: string

const activeTab = ref('general')

const tabs = [
  { id: 'general', icon: '⚙️', label: '通用' },
  { id: 'ai', icon: '🤖', label: 'AI 模型' },
  { id: 'voice', icon: '🎙️', label: '语音' },
  { id: 'about', icon: 'ℹ️', label: '关于' }
]

const generalSettings = reactive({
  theme: 'system' as ThemeMode,
  language: 'zh-CN',
  autoStart: false,
  minimizeToTray: true,
  notifications: true
})

const themeOptions: {
  mode: ThemeMode
  icon: string
  label: string
  desc: string
  colors: string
}[] = [
  {
    mode: 'light',
    icon: '☀️',
    label: '浅色模式',
    desc: '明亮清爽',
    colors: 'linear-gradient(135deg, #fef3c7, #fde68a, #fbbf24)'
  },
  {
    mode: 'dark',
    icon: '🌙',
    label: '深色模式',
    desc: '护眼沉浸',
    colors: 'linear-gradient(135deg, #312e81, #4338ca, #6366f1)'
  },
  {
    mode: 'system',
    icon: '🖥️',
    label: '跟随系统',
    desc: '自动切换',
    colors: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)'
  }
]

watch(
  () => generalSettings.theme,
  (val) => {
    setThemeMode(val)
  }
)

onMounted(() => {
  generalSettings.theme = getThemeMode()
})

const aiSettings = reactive({
  ...getAiParams(),
  streamResponse: true,
  autoRetry: true,
  maxRetries: 3
})

// AI 参数变更时自动持久化
watch(
  () => ({
    temperature: aiSettings.temperature,
    maxTokens: aiSettings.maxTokens,
    topP: aiSettings.topP,
    frequencyPenalty: aiSettings.frequencyPenalty,
    presencePenalty: aiSettings.presencePenalty
  }),
  (val) => {
    setAiParams(val)
  },
  { deep: true }
)

const voiceSettings = reactive({
  enabled: false,
  wakeWord: '小雨',
  language: 'zh-CN',
  voiceSpeed: 1.0,
  voicePitch: 1.0,
  autoPlay: true,
  noiseReduction: true
})

const versionInfo = {
  version: __APP_VERSION__,
  electron: process.versions.electron ?? '',
  vue: '3.5.25',
  node: process.versions.node ?? ''
}

function setThemeDirect(mode: ThemeMode): void {
  generalSettings.theme = mode
}
</script>

<template>
  <div class="settings-view">
    <div class="settings-header">
      <h1 class="view-title">⚙️ 设置</h1>
      <p class="view-desc">系统配置与偏好设置</p>
    </div>

    <div class="settings-layout">
      <div class="tabs-panel">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>

      <div class="settings-content">
        <!-- 通用设置 -->
        <div v-if="activeTab === 'general'" class="settings-section fade-in">
          <h2 class="section-title">通用设置</h2>

          <div class="setting-group">
            <div class="group-label">主题外观</div>
            <div class="theme-cards">
              <button
                v-for="opt in themeOptions"
                :key="opt.mode"
                class="theme-card"
                :class="{ active: generalSettings.theme === opt.mode }"
                @click="setThemeDirect(opt.mode)"
              >
                <div class="theme-preview" :style="{ background: opt.colors }">
                  <span class="preview-icon">{{ opt.icon }}</span>
                </div>
                <div class="theme-info">
                  <span class="theme-name">{{ opt.label }}</span>
                  <span class="theme-desc">{{ opt.desc }}</span>
                </div>
                <div v-if="generalSettings.theme === opt.mode" class="check-mark">✓</div>
              </button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">开机自启</div>
              <div class="setting-desc">系统启动时自动运行应用</div>
            </div>
            <label class="toggle-switch">
              <input v-model="generalSettings.autoStart" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">最小化到托盘</div>
              <div class="setting-desc">关闭窗口时最小化到系统托盘</div>
            </div>
            <label class="toggle-switch">
              <input v-model="generalSettings.minimizeToTray" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">桌面通知</div>
              <div class="setting-desc">接收消息和任务完成通知</div>
            </div>
            <label class="toggle-switch">
              <input v-model="generalSettings.notifications" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- AI 模型设置 -->
        <div v-if="activeTab === 'ai'" class="settings-section fade-in">
          <h2 class="section-title">AI 模型参数</h2>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">温度 (Temperature)</div>
              <div class="setting-desc">控制输出随机性，越高越有创意，越低越稳定</div>
            </div>
            <div class="setting-range">
              <input
                v-model.number="aiSettings.temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
              />
              <span class="range-value">{{ aiSettings.temperature }}</span>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">最大 Token 数</div>
              <div class="setting-desc">限制 AI 单次回复的最大长度</div>
            </div>
            <input
              v-model.number="aiSettings.maxTokens"
              type="number"
              class="setting-input"
              min="256"
              max="128000"
            />
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">Top-P 采样</div>
              <div class="setting-desc">核采样概率阈值，控制输出多样性</div>
            </div>
            <div class="setting-range">
              <input v-model.number="aiSettings.topP" type="range" min="0" max="1" step="0.05" />
              <span class="range-value">{{ aiSettings.topP }}</span>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">流式响应</div>
              <div class="setting-desc">启用流式输出，实时显示 AI 回复</div>
            </div>
            <label class="toggle-switch">
              <input v-model="aiSettings.streamResponse" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">自动重试</div>
              <div class="setting-desc">请求失败时自动重试</div>
            </div>
            <label class="toggle-switch">
              <input v-model="aiSettings.autoRetry" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">最大重试次数</div>
              <div class="setting-desc">自动重试的最大次数</div>
            </div>
            <input
              v-model.number="aiSettings.maxRetries"
              type="number"
              class="setting-input"
              min="1"
              max="10"
            />
          </div>
        </div>

        <!-- 语音设置 -->
        <div v-if="activeTab === 'voice'" class="settings-section fade-in">
          <h2 class="section-title">语音设置</h2>

          <div class="setting-item">
            <div class="setting-info">
              <div class="setting-label">启用语音功能</div>
              <div class="setting-desc">开启语音识别和语音播报</div>
            </div>
            <label class="toggle-switch">
              <input v-model="voiceSettings.enabled" type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item" :class="{ disabled: !voiceSettings.enabled }">
            <div class="setting-info">
              <div class="setting-label">唤醒词</div>
              <div class="setting-desc">语音唤醒的关键词</div>
            </div>
            <input
              v-model="voiceSettings.wakeWord"
              type="text"
              class="setting-input"
              :disabled="!voiceSettings.enabled"
              placeholder="例如：小雨"
            />
          </div>

          <div class="setting-item" :class="{ disabled: !voiceSettings.enabled }">
            <div class="setting-info">
              <div class="setting-label">语音速度</div>
              <div class="setting-desc">调整语音播报速度</div>
            </div>
            <div class="setting-range">
              <input
                v-model.number="voiceSettings.voiceSpeed"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                :disabled="!voiceSettings.enabled"
              />
              <span class="range-value">{{ voiceSettings.voiceSpeed }}x</span>
            </div>
          </div>

          <div class="setting-item" :class="{ disabled: !voiceSettings.enabled }">
            <div class="setting-info">
              <div class="setting-label">语音音调</div>
              <div class="setting-desc">调整语音播报音调</div>
            </div>
            <div class="setting-range">
              <input
                v-model.number="voiceSettings.voicePitch"
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                :disabled="!voiceSettings.enabled"
              />
              <span class="range-value">{{ voiceSettings.voicePitch }}</span>
            </div>
          </div>

          <div class="setting-item" :class="{ disabled: !voiceSettings.enabled }">
            <div class="setting-info">
              <div class="setting-label">自动播报</div>
              <div class="setting-desc">AI 回复后自动语音播报</div>
            </div>
            <label class="toggle-switch">
              <input
                v-model="voiceSettings.autoPlay"
                type="checkbox"
                :disabled="!voiceSettings.enabled"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="setting-item" :class="{ disabled: !voiceSettings.enabled }">
            <div class="setting-info">
              <div class="setting-label">降噪处理</div>
              <div class="setting-desc">启用麦克风降噪，提高识别准确率</div>
            </div>
            <label class="toggle-switch">
              <input
                v-model="voiceSettings.noiseReduction"
                type="checkbox"
                :disabled="!voiceSettings.enabled"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="voice-test" :class="{ disabled: !voiceSettings.enabled }">
            <h3 class="subsection-title">语音测试</h3>
            <div class="test-buttons">
              <button class="action-btn" :disabled="!voiceSettings.enabled">
                <span>🎤</span> 录音测试
              </button>
              <button class="action-btn" :disabled="!voiceSettings.enabled">
                <span>🔊</span> 播放测试
              </button>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div v-if="activeTab === 'about'" class="settings-section fade-in">
          <h2 class="section-title">关于</h2>

          <div class="about-card">
            <div class="about-logo">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="url(#aboutGrad)"
                  stroke-width="2"
                  fill="none"
                />
                <path
                  d="M22 32L29 39L42 25"
                  stroke="url(#aboutGrad)"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <defs>
                  <linearGradient id="aboutGrad" x1="0" y1="0" x2="64" y2="64">
                    <stop offset="0%" stop-color="#a855f7" />
                    <stop offset="100%" stop-color="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h3 class="about-name">Light Rain Agent</h3>
            <p class="about-version">v{{ versionInfo.version }}</p>

            <div class="about-info">
              <div class="info-row">
                <span class="info-label">Electron</span>
                <span class="info-value">{{ versionInfo.electron }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Vue</span>
                <span class="info-value">{{ versionInfo.vue }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Node.js</span>
                <span class="info-value">{{ versionInfo.node }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  padding: var(--space-lg) var(--space-xl);
  height: 100%;
  overflow-y: auto;
}

.settings-header {
  margin-bottom: var(--space-xl);
}

.view-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.view-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.settings-layout {
  display: flex;
  gap: var(--space-xl);
  max-width: 1000px;
}

.tabs-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 180px;
  padding: 8px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--accent-gradient);
  color: white;
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

.tab-icon {
  font-size: 16px;
}

.settings-content {
  flex: 1;
  min-width: 0;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.fade-in {
  animation: sectionIn 0.3s ease;
}

@keyframes sectionIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
  letter-spacing: -0.01em;
}

.subsection-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
}

.setting-group {
  padding: 16px 20px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
}

.group-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.theme-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 12px;
  background: var(--bg-tertiary);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--text-primary);
}

.theme-card:hover {
  border-color: var(--border-accent);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.theme-card.active {
  border-color: var(--accent-primary);
  background: var(--bg-glass-hover);
  box-shadow: 0 8px 32px rgba(96, 165, 250, 0.25);
}

.theme-preview {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.theme-card:hover .theme-preview {
  transform: scale(1.1);
}

.preview-icon {
  font-size: 24px;
}

.theme-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.theme-name {
  font-size: 13px;
  font-weight: 600;
}

.theme-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.check-mark {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  background: var(--accent-gradient);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: white;
  font-weight: 700;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.setting-item:hover {
  border-color: var(--border-accent);
  background: var(--bg-glass-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.setting-item.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.setting-select,
.setting-input {
  padding: 8px 14px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  min-width: 140px;
  outline: none;
  transition: all var(--transition-fast);
}

.setting-select:focus,
.setting-input:focus {
  outline: none;
}

.setting-select:hover,
.setting-input:hover {
  border-color: var(--border-hover);
}

.setting-range {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.setting-range input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 140px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--bg-tertiary);
  outline: none;
  cursor: pointer;
}

.setting-range input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-gradient);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(96, 165, 250, 0.4);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.setting-range input[type='range']::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.5);
}

.setting-range input[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: var(--accent-gradient);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(96, 165, 250, 0.4);
}

.range-value {
  font-size: 13px;
  color: var(--text-primary);
  min-width: 48px;
  text-align: center;
  font-family: var(--font-code);
  font-weight: 600;
  padding: 3px 10px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-xs);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 28px;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  transition: all var(--transition-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 3px;
  transform: translateY(-50%);
  height: 22px;
  width: 22px;
  background: var(--text-secondary);
  border-radius: 50%;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--accent-gradient);
  border-color: transparent;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateY(-50%) translateX(22px);
  background: white;
  box-shadow: 0 2px 10px rgba(96, 165, 250, 0.5);
}

.toggle-switch input:focus-visible + .toggle-slider {
  box-shadow: none;
}

.voice-test {
  padding: var(--space-lg);
  background: var(--bg-glass);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
}

.voice-test.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.test-buttons {
  display: flex;
  gap: var(--space-sm);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: 1px solid var(--border-glass);
  background: var(--bg-glass);
  backdrop-filter: var(--blur-sm);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.2);
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-2xl) var(--space-xl);
  background: var(--bg-glass);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-xl);
  text-align: center;
}

.about-logo {
  margin-bottom: var(--space-md);
  filter: drop-shadow(0 0 20px var(--accent-glow));
}

.about-name {
  font-size: 22px;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 6px;
  letter-spacing: -0.02em;
}

.about-version {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: var(--space-lg);
}

.about-info {
  width: 100%;
  max-width: 260px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 13px;
  color: var(--text-primary);
  font-family: var(--font-code);
}
</style>
