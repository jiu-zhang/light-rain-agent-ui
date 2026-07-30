<script setup lang="ts">
import { onMounted } from 'vue'
import { initTheme } from '@renderer/utils'
import RainBackground from '@renderer/components/background/RainBackground.vue'
import UpdateDialog from '@renderer/components/common/UpdateDialog.vue'
import StartupLoading from '@renderer/components/common/StartupLoading.vue'

onMounted(() => {
  initTheme()
})
</script>

<template>
  <StartupLoading />
  <RainBackground />
  <router-view />
  <UpdateDialog />
</template>
