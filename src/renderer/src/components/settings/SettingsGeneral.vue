<script setup lang="ts">
import { ref, watch } from 'vue'
import { getThemeMode, setThemeMode, getAiParams, setAiParams } from '@renderer/utils'
import type { ThemeMode } from '@renderer/utils'

const themeMode = ref<ThemeMode>(getThemeMode())
const aiParams = ref(getAiParams())

watch(aiParams, () => setAiParams(aiParams.value), { deep: true })

const themeOptions = [
  { mode: 'light' as ThemeMode, icon: '☀️', label: '浅色', desc: '明亮清爽', colors: 'linear-gradient(135deg, #fef3c7, #fde68a, #fbbf24)' },
  { mode: 'dark' as ThemeMode, icon: '🌙', label: '深色', desc: '护眼沉浸', colors: 'linear-gradient(135deg, #312e81, #4338ca, #6366f1)' },
  { mode: 'system' as ThemeMode, icon: '🖥️', label: '跟随系统', desc: '自动切换', colors: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)' }
]
</script>

<template>
  <div class="section-block">
    <div class="section-label">🎨 主题外观</div>
    <div class="theme-options">
      <button
        v-for="opt in themeOptions"
        :key="opt.mode"
        class="theme-card"
        :class="{ active: themeMode === opt.mode }"
        @click="themeMode = opt.mode; setThemeMode(opt.mode)"
      >
        <div class="theme-preview" :style="{ background: opt.colors }">
          <span class="preview-icon">{{ opt.icon }}</span>
        </div>
        <div class="theme-info">
          <span class="theme-name">{{ opt.label }}</span>
          <span class="theme-desc">{{ opt.desc }}</span>
        </div>
        <div v-if="themeMode === opt.mode" class="check-mark">✓</div>
      </button>
    </div>
  </div>

  <div class="section-block">
    <div class="section-label">📝 系统提示词</div>
    <textarea
      v-model="aiParams.systemPrompt"
      class="prompt-textarea"
      rows="4"
      placeholder="设置 AI 助手的角色和行为方式，例如：你是一个专业的编程助手..."
    />
  </div>

  <div class="section-block">
    <div class="section-label">🤖 AI 参数</div>
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
          <input v-model.number="aiParams.maxTokens" type="number" min="256" max="128000" step="1" class="param-input" />
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
.section-block { margin-bottom: 20px; }
.section-block:last-child { margin-bottom: 0; }
.section-label { font-size: 12px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
.prompt-textarea { width: 100%; padding: 12px 14px; border: 1px solid var(--border-glass); border-radius: 12px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px; line-height: 1.7; resize: vertical; outline: none; box-sizing: border-box; min-height: 90px; font-family: inherit; }
.prompt-textarea:focus { outline: none; }
.prompt-textarea::placeholder { color: var(--text-quaternary); }
.theme-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.theme-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 10px; background: var(--bg-tertiary); border: 2px solid transparent; border-radius: 14px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: var(--text-primary); }
.theme-card:hover { border-color: color-mix(in srgb, var(--accent-primary) 35%, transparent); transform: translateY(-2px); box-shadow: var(--shadow-sm); }
.theme-card.active { border-color: var(--accent-primary); background: color-mix(in srgb, var(--accent-primary) 8%, transparent); box-shadow: 0 8px 32px rgba(96, 165, 250, 0.2); }
.theme-preview { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.theme-card:hover .theme-preview { transform: scale(1.1); }
.preview-icon { font-size: 18px; }
.theme-info { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.theme-name { font-size: 12px; font-weight: 600; }
.theme-desc { font-size: 11px; color: var(--text-tertiary); }
.check-mark { position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: 700; }
.ai-params { display: flex; flex-direction: column; gap: 10px; }
.param-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--bg-tertiary); border: 1px solid var(--border-glass); border-radius: 10px; gap: 12px; }
.param-info { flex: 1; min-width: 0; }
.param-name { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.param-desc { font-size: 11px; color: var(--text-tertiary); }
.param-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.param-control input[type='range'] { -webkit-appearance: none; appearance: none; width: 100px; height: 5px; border-radius: 999px; background: var(--bg-quaternary); outline: none; cursor: pointer; }
.param-control input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent-gradient); cursor: pointer; box-shadow: 0 2px 6px rgba(96, 165, 250, 0.3); }
.param-value { min-width: 32px; text-align: center; font-size: 13px; font-weight: 600; color: var(--text-primary); font-family: var(--font-code); padding: 2px 8px; background: var(--bg-quaternary); border-radius: 6px; }
.param-input { width: 100px; padding: 6px 10px; background: var(--bg-quaternary); border: 1px solid var(--border-glass); border-radius: 8px; color: var(--text-primary); font-size: 13px; font-family: var(--font-code); text-align: center; outline: none; }
.param-input:focus { outline: none; }
</style>
