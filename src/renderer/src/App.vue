<script setup lang="ts">
import { onMounted } from 'vue'
import { initTheme } from '@renderer/utils'
import { setBackendPort } from '@renderer/api'
import RainBackground from '@renderer/components/background/RainBackground.vue'
import UpdateDialog from '@renderer/components/common/UpdateDialog.vue'

onMounted(() => {
  initTheme()

  // 监听后端端口通知
  window.api.onBackendReady(({ port }) => {
    setBackendPort(port)
    console.log(`[App] Backend ready on port ${port}`)
  })
})
</script>

<template>
  <RainBackground />
  <router-view />
  <UpdateDialog />
</template>
