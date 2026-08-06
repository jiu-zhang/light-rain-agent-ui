<script setup lang="ts">
import SettingsCron from '@renderer/components/settings/SettingsCron.vue'
import Icon from '@renderer/components/common/Icon.vue'
</script>

<template>
  <div class="page-layout cron-layout">
    <div class="main-content">
      <div class="page-header">
        <h1 class="page-title">
          <Icon name="clock" :size="24" class="title-icon" />
          定时任务
        </h1>
        <p class="page-desc">创建和管理定时执行的 AI 任务</p>
      </div>
      <div class="content-area">
        <SettingsCron />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-layout {
  display: flex;
  height: 100%;
  padding: var(--space-lg) var(--space-xl);
}

.cron-layout {
  justify-content: center;
}

.main-content {
  max-width: 1000px;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: var(--space-lg);
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  color: var(--accent-primary);
}

.page-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.content-area {
  flex: 1;
  min-height: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.page-content {
  max-width: 720px;
}
</style>
