<script setup lang="ts">
import SettingsCron from '@renderer/components/settings/SettingsCron.vue'
import Icon from '@renderer/components/common/Icon.vue'
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">
        <Icon name="clock" :size="24" class="title-icon" />
        定时任务
      </h1>
      <p class="page-desc">创建和管理定时执行的 AI 任务</p>
    </div>
    <div class="page-content">
      <SettingsCron />
    </div>
  </div>
</template>

<style scoped>
.page-container {
  padding: var(--space-lg) var(--space-xl);
  height: 100%;
  overflow-y: auto;
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

.page-content {
  max-width: 720px;
}
</style>
