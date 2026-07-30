<script setup lang="ts">
declare const __APP_VERSION__: string
</script>

<template>
  <div class="about-section">
    <div class="about-logo">
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="28" stroke="url(#abtG)" stroke-width="2" fill="none" />
        <path d="M22 32L29 39L42 25" stroke="url(#abtG)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <defs>
          <linearGradient id="abtG" x1="0" y1="0" x2="64" y2="64">
            <stop offset="0%" stop-color="var(--accent-primary)" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <h3 class="about-name">Light Rain Agent</h3>
    <p class="about-version">v{{ __APP_VERSION__ }}</p>
    <div class="about-info">
      <div class="info-row"><span class="info-label">Electron</span><span class="info-value">39.2.6</span></div>
      <div class="info-row"><span class="info-label">Vue</span><span class="info-value">3.5.25</span></div>
      <div class="info-row"><span class="info-label">Node.js</span><span class="info-value">20.11.0</span></div>
    </div>
    <p class="about-desc">智能 AI 助手 · 雨夜中的微光</p>
  </div>
</template>

<style scoped>
.about-section { display: flex; flex-direction: column; align-items: center; padding: 32px 20px; text-align: center; }
.about-logo { margin-bottom: 16px; filter: drop-shadow(0 0 20px var(--accent-glow)); }
.about-name { font-size: 20px; font-weight: 700; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px; }
.about-version { font-size: 13px; color: var(--text-tertiary); margin-bottom: 20px; }
.about-info { width: 100%; max-width: 240px; margin-bottom: 20px; }
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color); }
.info-row:last-child { border-bottom: none; }
.info-label { font-size: 13px; color: var(--text-secondary); }
.info-value { font-size: 13px; color: var(--text-primary); font-family: var(--font-code); }
.about-desc { font-size: 13px; color: var(--text-tertiary); letter-spacing: 0.03em; }
</style>
