<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { notifyError } from '@renderer/utils/feedback'
import api from '@renderer/api'
import Icon, { type IconName } from './Icon.vue'

enum ConnectionState {
  UNKNOWN = 'unknown',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

const state = ref<ConnectionState>(ConnectionState.UNKNOWN)
const lastConnected = ref<Date | null>(null)
const reconnectAttempts = ref(0)
const statusMessage = ref('检测连接状态...')

let pingInterval: number | null = null
let reconnectTimeout: number | null = null

const stateConfig: Record<ConnectionState, { icon: IconName; color: string; label: string }> = {
  [ConnectionState.UNKNOWN]: {
    icon: 'activity',
    color: 'var(--text-tertiary)',
    label: '检查连接'
  },
  [ConnectionState.CONNECTED]: {
    icon: 'check-circle',
    color: 'var(--accent-success)',
    label: '已连接'
  },
  [ConnectionState.DISCONNECTED]: {
    icon: 'alert',
    color: 'var(--accent-error)',
    label: '连接断开'
  },
  [ConnectionState.RECONNECTING]: {
    icon: 'loader',
    color: 'var(--accent-warning)',
    label: '重连中'
  },
  [ConnectionState.ERROR]: {
    icon: 'error',
    color: 'var(--accent-error)',
    label: '连接错误'
  }
}

function checkConnection(): Promise<boolean> {
  return fetch(healthCheckUrl(), {
    method: 'GET',
    cache: 'no-store'
  })
    .then((response) => response.ok)
    .catch(() => false)
}

/** 后端健康检查地址：file:// 下相对路径会解析失败，必须用绝对地址 */
function healthCheckUrl(): string {
  const base = api.defaults.baseURL ?? ''
  return base.startsWith('http') ? `${base}/api/health` : '/api/health'
}

async function ping(): Promise<void> {
  const wasConnected = state.value === ConnectionState.CONNECTED

  try {
    const isAlive = await checkConnection()

    if (isAlive) {
      if (state.value !== ConnectionState.CONNECTED) {
        state.value = ConnectionState.CONNECTED
        lastConnected.value = new Date()
        reconnectAttempts.value = 0
        statusMessage.value = '后端连接正常'
      }
    } else {
      throw new Error('响应异常')
    }
  } catch {
    if (wasConnected) {
      state.value = ConnectionState.DISCONNECTED
      statusMessage.value = '与后端连接断开'
    }

    if (state.value === ConnectionState.DISCONNECTED) {
      attemptReconnect()
    }
  }
}

function attemptReconnect(): void {
  if (reconnectAttempts.value > 10) {
    state.value = ConnectionState.ERROR
    statusMessage.value = '连接失败，请检查后端服务'
    notifyError('无法连接到后端服务，请确认服务已启动')
    return
  }

  state.value = ConnectionState.RECONNECTING
  reconnectAttempts.value++
  statusMessage.value = `正在尝试重连... (${reconnectAttempts.value}/10)`

  const delay = Math.min(1000 * reconnectAttempts.value, 5000)

  reconnectTimeout = window.setTimeout(async () => {
    await ping()
  }, delay)
}

onMounted(() => {
  ping()
  pingInterval = window.setInterval(ping, 10000)
})

onBeforeUnmount(() => {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
  }
})

const config = computed(() => stateConfig[state.value])
</script>

<template>
  <div class="connection-status" :data-state="state">
    <div class="status-indicator">
      <Icon :name="config.icon" :size="14" class="status-icon" />
      <span class="status-text">{{ config.label }}</span>
    </div>

    <div v-if="state === ConnectionState.RECONNECTING" class="reconnect-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${(reconnectAttempts / 10) * 100}%` }" />
      </div>
    </div>

    <div class="status-details" :title="statusMessage">
      <span v-if="lastConnected" class="last-connected">
        {{ lastConnected.toLocaleTimeString() }}
      </span>
      <span v-else class="status-message">{{ statusMessage }}</span>
    </div>
  </div>
</template>

<style scoped>
.connection-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-icon {
  color: v-bind('config.color');
  animation:
    var(--animation-fade-in),
    v-bind("state === ConnectionState.RECONNECTING ? 'spin 1s linear infinite' : 'none'");
}

.status-text {
  font-weight: 600;
  color: var(--text-primary);
}

.status-details {
  color: var(--text-secondary);
  font-size: 11px;
}

.last-connected {
  font-family: var(--font-code);
}

.reconnect-progress {
  margin: 4px 0;
}

.progress-bar {
  height: 3px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-warning), var(--accent-primary));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.connection-status[data-state='unknown'] {
  background: var(--bg-tertiary);
}

.connection-status[data-state='connected'] {
  background: color-mix(in srgb, var(--accent-success) 5%, transparent);
  border-color: color-mix(in srgb, var(--accent-success) 20%, transparent);
}

.connection-status[data-state='disconnected'],
.connection-status[data-state='error'] {
  background: color-mix(in srgb, var(--accent-error) 5%, transparent);
  border-color: color-mix(in srgb, var(--accent-error) 20%, transparent);
}

.connection-status[data-state='reconnecting'] {
  background: color-mix(in srgb, var(--accent-warning) 5%, transparent);
  border-color: color-mix(in srgb, var(--accent-warning) 20%, transparent);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0);
  }
}
</style>
