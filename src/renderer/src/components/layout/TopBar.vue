<script setup lang="ts">
defineEmits<{ openSettings: []; newSession: [] }>()
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="url(#lg)" stroke-width="1.5" fill="none" />
          <path
            d="M8 12l3 3 5-6"
            stroke="url(#lg)"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="24" y2="24">
              <stop stop-color="#60a5fa" />
              <stop offset="1" stop-color="#34d399" />
            </linearGradient>
          </defs>
        </svg>
        <span class="logo-text">Light Rain</span>
      </div>
      <button class="new-chat-btn" title="新对话" @click="$emit('newSession')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>新对话</span>
      </button>
    </div>
    <button class="gear-btn" title="设置" @click="$emit('openSettings')">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </button>
  </header>
</template>

<style scoped>
.topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  pointer-events: none;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-glass);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}

.logo:hover {
  border-color: var(--border-accent);
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.1);
}

.logo-text {
  font-size: 17px;
  font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #34d399);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.01em;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-glass);
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  border-radius: 999px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.new-chat-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.15);
}

.gear-btn {
  width: 42px;
  height: 42px;
  border: 1px solid var(--border-glass);
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
}

.gear-btn:hover {
  border-color: color-mix(in srgb, var(--accent-primary) 50%, transparent);
  color: var(--accent-primary);
  box-shadow: 0 0 20px rgba(96, 165, 250, 0.25);
  transform: rotate(90deg) scale(1.05);
}

.gear-btn:active {
  transform: rotate(90deg) scale(0.95);
}
</style>
