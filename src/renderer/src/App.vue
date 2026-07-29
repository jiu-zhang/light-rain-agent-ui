<script setup lang="ts">
import { onMounted } from 'vue'
import { initTheme } from '@renderer/utils'
import RainBackground from '@renderer/components/background/RainBackground.vue'

onMounted(() => {
  initTheme()
})
</script>

<template>
  <RainBackground />
  <router-view />
</template>
