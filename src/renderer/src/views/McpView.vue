<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { mcpApi, type McpConfig, type McpConfigForm } from '@renderer/api/mcp'
import Icon from '@renderer/components/common/Icon.vue'

const configs = ref<McpConfig[]>([])
const loading = ref(false)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const connectingId = ref<number | null>(null)
const form = ref<McpConfigForm>({
  name: '',
  transportType: 'SSE',
  baseUrl: '',
  endpoint: '',
  headers: '',
  command: '',
  args: '',
  env: '',
  requestTimeout: 30
})

const TRANSPORTS = ['SSE', 'STREAMABLE', 'STDIO']

const statusMap: Record<number, { label: string; cls: string }> = {
  0: { label: '连接中', cls: 'pending' },
  1: { label: '已连接', cls: 'on' },
  2: { label: '已断开', cls: 'off' }
}

function statusInfo(s?: number): { label: string; cls: string } {
  return statusMap[s ?? 2] ?? statusMap[2]
}

const isStdio = computed(() => form.value.transportType === 'STDIO')

async function loadConfigs(): Promise<void> {
  loading.value = true
  try {
    const res = await mcpApi.list()
    if (res.code === 200) configs.value = res.data || []
  } catch {
    configs.value = []
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.value = {
    name: '',
    transportType: 'SSE',
    baseUrl: '',
    endpoint: '',
    headers: '',
    command: '',
    args: '',
    env: '',
    requestTimeout: 30
  }
  showForm.value = true
}

function openEdit(c: McpConfig): void {
  editingId.value = c.id
  form.value = {
    name: c.name,
    transportType: c.transportType,
    baseUrl: c.baseUrl || '',
    endpoint: c.endpoint || '',
    headers: c.headers || '',
    command: c.command || '',
    args: c.args || '',
    env: c.env || '',
    requestTimeout: c.requestTimeout ?? 30
  }
  showForm.value = true
}

function cancelForm(): void {
  showForm.value = false
}

async function saveForm(): Promise<void> {
  if (!form.value.name.trim() || !form.value.transportType) return
  if (!isStdio.value && !form.value.baseUrl?.trim()) return
  if (isStdio.value && !form.value.command?.trim()) return
  try {
    if (editingId.value) {
      await mcpApi.update(editingId.value, { ...form.value })
    } else {
      await mcpApi.create({ ...form.value })
    }
    showForm.value = false
    await loadConfigs()
  } catch {
    // 已由拦截器统一提示
  }
}

async function toggleConnect(c: McpConfig): Promise<void> {
  if (connectingId.value) return
  if (c.connectionStatus === 1) {
    try {
      await mcpApi.disconnect(c.id)
    } catch {
      // 已提示
    }
  } else if (c.connectionStatus !== 0) {
    connectingId.value = c.id
    try {
      await mcpApi.connect(c.id)
    } catch {
      // 已提示
    } finally {
      connectingId.value = null
    }
  }
  await loadConfigs()
}

async function deleteConfig(c: McpConfig): Promise<void> {
  try {
    await mcpApi.remove(c.id)
    configs.value = configs.value.filter((x) => x.id !== c.id)
  } catch {
    // 已由拦截器统一提示
  }
}

function formatTime(ts?: number): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return '—'
  }
}

function transportBadge(t: string): string {
  switch (t) {
    case 'SSE':
      return 'SSE'
    case 'STREAMABLE':
      return 'HTTP'
    case 'STDIO':
      return 'STDIO'
    default:
      return t
  }
}

onMounted(loadConfigs)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">
        <Icon name="globe" :size="24" class="title-icon" />
        MCP 服务器
      </h1>
      <p class="page-desc">管理 Model Context Protocol 服务器，连接后其工具将自动注入 Agent</p>
    </div>

    <div class="section-block">
      <div class="section-head">
        <span class="section-label">
          <Icon name="globe" :size="12" />
          已配置的服务器
        </span>
        <button class="action-btn sm" @click="openCreate">
          <Icon name="plus" :size="12" />
          <span>新建服务器</span>
        </button>
      </div>

      <div v-if="loading" class="state-box">
        <span>加载中...</span>
      </div>
      <div v-else-if="configs.length === 0" class="state-box">
        <span style="font-size: 13px">暂无 MCP 服务器，点击"新建服务器"添加一个</span>
      </div>
      <div v-else class="list">
        <div v-for="c in configs" :key="c.id" class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">
              {{ c.name }}
              <span class="transport-badge">{{ transportBadge(c.transportType) }}</span>
              <span v-if="c.transportType !== 'STDIO'" class="url-text">{{ c.baseUrl }}</span>
              <span v-else class="url-text">{{ c.command }}</span>
            </div>
            <div class="list-item-meta">
              <template v-if="c.errorMessage">上次失败: {{ c.errorMessage }}</template>
              <template v-else-if="c.connectedTime">连接于 {{ formatTime(c.connectedTime) }}</template>
              <template v-else>尚未连接</template>
            </div>
          </div>
          <button class="toggle-btn" :class="statusInfo(c.connectionStatus).cls" @click="toggleConnect(c)">
            <Icon v-if="connectingId === c.id" name="loader" :size="11" class="spin" />
            {{ connectingId === c.id ? '连接中' : statusInfo(c.connectionStatus).label }}
          </button>
          <button class="action-btn sm" @click="openEdit(c)">
            <Icon name="edit" :size="12" />
            <span>编辑</span>
          </button>
          <button class="action-btn sm danger" @click="deleteConfig(c)">
            <Icon name="trash" :size="12" />
            <span>删除</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 新建/编辑弹框 -->
    <div v-if="showForm" class="modal-inner-overlay">
      <div class="modal-inner-box">
        <h3>{{ editingId ? '编辑 MCP 服务器' : '新建 MCP 服务器' }}</h3>
        <div class="form-row">
          <label>服务器名称</label>
          <input v-model="form.name" placeholder="如：本地文件系统" />
        </div>
        <div class="form-row">
          <label>传输方式</label>
          <div class="transport-tabs">
            <button
              v-for="t in TRANSPORTS"
              :key="t"
              class="transport-tab"
              :class="{ active: form.transportType === t }"
              @click="form.transportType = t"
            >
              {{ t === 'STREAMABLE' ? 'Streamable HTTP' : t }}
            </button>
          </div>
        </div>
        <template v-if="!isStdio">
          <div class="form-row">
            <label>服务器地址 (baseUrl)</label>
            <input v-model="form.baseUrl" placeholder="如：http://localhost:8081/mcp" />
          </div>
          <div class="form-row">
            <label>自定义端点路径（可选，默认 /mcp）</label>
            <input v-model="form.endpoint" placeholder="如 /mcp/sse" />
          </div>
          <div class="form-row">
            <label>请求头（JSON，可选）</label>
            <input v-model="form.headers" placeholder='如 {"Authorization": "Bearer xxx"}' />
          </div>
        </template>
        <template v-else>
          <div class="form-row">
            <label>启动命令</label>
            <input v-model="form.command" placeholder="如：npx" />
          </div>
          <div class="form-row">
            <label>启动参数（JSON 数组，可选）</label>
            <input v-model="form.args" placeholder='如 ["-y", "@modelcontextprotocol/server-filesystem"]' />
          </div>
          <div class="form-row">
            <label>环境变量（JSON 对象，可选）</label>
            <input v-model="form.env" placeholder='如 {"KEY": "value"}' />
          </div>
        </template>
        <div class="form-row">
          <label>请求超时（秒）</label>
          <input v-model.number="form.requestTimeout" type="number" min="1" />
        </div>
        <div class="form-actions">
          <button class="action-btn" @click="cancelForm">取消</button>
          <button
            class="action-btn primary"
            :disabled="
              !form.name.trim() || (!isStdio && !form.baseUrl?.trim()) || (isStdio && !form.command?.trim())
            "
            @click="saveForm"
          >
            保存
          </button>
        </div>
      </div>
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

.section-block {
  max-width: 760px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 40px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.list-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.list-item-main {
  flex: 1;
  min-width: 0;
}

.list-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.transport-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font-family: var(--font-code);
}

.url-text {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-code);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.list-item-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 3px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: var(--bg-hover);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.action-btn.sm {
  padding: 5px 12px;
  font-size: 12px;
}

.action-btn.danger {
  border-color: var(--border-color);
  color: var(--accent-error);
}

.toggle-btn {
  font-size: 11px;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  border: 1px solid;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-weight: 500;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
}

.toggle-btn.on {
  background: color-mix(in srgb, var(--accent-success) 12%, transparent);
  color: var(--accent-success);
  border-color: color-mix(in srgb, var(--accent-success) 30%, transparent);
}

.toggle-btn.off {
  background: color-mix(in srgb, var(--accent-error) 12%, transparent);
  color: var(--accent-error);
  border-color: color-mix(in srgb, var(--accent-error) 30%, transparent);
}

.toggle-btn.pending {
  background: color-mix(in srgb, var(--accent-warning, #f59e0b) 12%, transparent);
  color: var(--accent-warning, #f59e0b);
  border-color: color-mix(in srgb, var(--accent-warning, #f59e0b) 30%, transparent);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.modal-inner-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayIn 0.15s ease;
}

.modal-inner-box {
  width: 460px;
  max-width: 92vw;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-xl);
  animation: modalIn 0.2s ease;
}

.modal-inner-box h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 18px;
}

.form-row {
  margin-bottom: 14px;
}

.form-row label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}

.form-row input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}

.transport-tabs {
  display: flex;
  gap: 8px;
}

.transport-tab {
  flex: 1;
  padding: 8px 0;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}

.transport-tab.active {
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

@keyframes overlayIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
