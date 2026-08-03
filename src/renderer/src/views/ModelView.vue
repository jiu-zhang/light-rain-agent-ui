<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { providerApi } from '@renderer/api/provider'
import { modelApi } from '@renderer/api/model'
import type { AiProvider, AiModel, AiModelList } from '@renderer/types'
import Icon from '@renderer/components/common/Icon.vue'

const providers = ref<AiProvider[]>([])
const modelsMap = ref<Record<number, AiModelList[]>>({})
const selectedProviderId = ref<number | null>(null)
const loading = ref(false)
const testingId = ref<number | null>(null)
const testResults = ref<Record<number, { latencyMs: number }>>({})

/** 测试模型连通性 */
async function testModel(id: number): Promise<void> {
  testingId.value = id
  try {
    const res = await modelApi.test(id)
    testResults.value[id] = { latencyMs: res.data?.latencyMs ?? -1 }
  } catch {
    testResults.value[id] = { latencyMs: -1 }
  } finally {
    testingId.value = null
  }
}

/** 厂商连通状态：任一模型测试成功→正常；有失败→异常；未测→未测试 */
function providerStatus(providerId: number): 'ok' | 'fail' | 'untested' {
  const models = modelsMap.value[providerId] || []
  let tested = false
  let failed = false
  for (const m of models) {
    const r = testResults.value[m.id]
    if (r) {
      tested = true
      if (r.latencyMs < 0) failed = true
    }
  }
  if (!tested) return 'untested'
  return failed ? 'fail' : 'ok'
}

const selectedProvider = computed(() =>
  providers.value.find((p) => p.id === selectedProviderId.value)
)

const currentModels = computed(() => {
  if (!selectedProviderId.value) return []
  return modelsMap.value[selectedProviderId.value] || []
})

async function loadAll(): Promise<void> {
  loading.value = true
  try {
    const provRes = await providerApi.listAll()
    if (provRes.code === 200 && provRes.data?.length) {
      providers.value = provRes.data
      if (
        !selectedProviderId.value ||
        !provRes.data.find((p) => p.id === selectedProviderId.value)
      ) {
        selectedProviderId.value = provRes.data[0]?.id ?? null
      }
    } else {
      providers.value = []
      selectedProviderId.value = null
      return
    }
    // 加载选中厂商的模型
    if (selectedProviderId.value) {
      const modRes = await modelApi.listByProvider(selectedProviderId.value)
      if (modRes.code === 200) {
        modelsMap.value[selectedProviderId.value] = modRes.data || []
      }
    }
  } catch {
    providers.value = []
    selectedProviderId.value = null
  } finally {
    loading.value = false
  }
}

/** 切换厂商时加载该厂商的模型 */
async function selectProvider(id: number): Promise<void> {
  selectedProviderId.value = id
  try {
    const res = await modelApi.listByProvider(id)
    if (res.code === 200) {
      modelsMap.value[id] = res.data || []
    }
  } catch {
    modelsMap.value[id] = []
  }
}

// Model dialogs
const showModelForm = ref(false)
const editingModel = ref<AiModel | null>(null)
const modelForm = ref({
  name: '',
  isDefault: 0,
  isEnabled: 1,
  sortOrder: 0,
  apiKey: '',
  baseUrl: ''
})

function openAddModel(): void {
  if (!selectedProviderId.value) return
  editingModel.value = null
  modelForm.value = { name: '', isDefault: 0, isEnabled: 1, sortOrder: 0, apiKey: '', baseUrl: '' }
  showModelForm.value = true
}

function openEditModel(m: AiModel): void {
  editingModel.value = m
  modelForm.value = {
    name: m.name,
    isDefault: m.isDefault,
    isEnabled: m.isEnabled,
    sortOrder: m.sortOrder || 0,
    apiKey: m.apiKey || '',
    baseUrl: m.baseUrl || ''
  }
  showModelForm.value = true
}

async function saveModel(): Promise<void> {
  if (!selectedProviderId.value) return
  try {
    if (editingModel.value) {
      await modelApi.update({
        ...modelForm.value,
        id: editingModel.value.id,
        providerId: selectedProviderId.value
      })
    } else {
      await modelApi.add({ ...modelForm.value, providerId: selectedProviderId.value })
    }
    showModelForm.value = false
    await loadAll()
  } catch (e) {
    console.warn(e)
  }
}

async function deleteModel(id: number): Promise<void> {
  try {
    await modelApi.delete(id)
    if (selectedProviderId.value && modelsMap.value[selectedProviderId.value]) {
      modelsMap.value[selectedProviderId.value] = modelsMap.value[selectedProviderId.value].filter(
        (m) => m.id !== id
      )
    }
  } catch (e) {
    console.warn(e)
  }
}

// Provider patch dialog (only apiKey, baseUrl, sortOrder)
const showProviderPatch = ref(false)
const patchingProvider = ref<AiProvider | null>(null)
const patchForm = ref({ apiKey: '', baseUrl: '', sortOrder: 0 })

function openPatchProvider(p: AiProvider): void {
  patchingProvider.value = p
  patchForm.value = {
    apiKey: p.apiKey || '',
    baseUrl: p.baseUrl || '',
    sortOrder: p.sortOrder || 0
  }
  showProviderPatch.value = true
}

async function savePatch(): Promise<void> {
  if (!patchingProvider.value) return
  try {
    await providerApi.update({
      id: patchingProvider.value.id,
      apiKey: patchForm.value.apiKey || undefined,
      baseUrl: patchForm.value.baseUrl || undefined,
      sortOrder: patchForm.value.sortOrder
    })
    showProviderPatch.value = false
    await loadAll()
  } catch (e) {
    console.warn(e)
  }
}

onMounted(() => loadAll())
</script>

<template>
  <div class="view-container model-view">
    <div class="view-header">
      <div class="header-content">
        <h1 class="view-title">模型配置</h1>
        <p class="view-desc">管理 AI 模型（厂商数据由系统初始化）</p>
      </div>
      <button class="action-btn" @click="loadAll">
        <Icon name="refresh" :size="14" class="btn-icon" />
        <span>刷新</span>
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loader"></div>
      <span>加载中...</span>
    </div>

    <template v-else>
      <div class="config-layout">
        <!-- 左侧：厂商列表 -->
        <aside class="config-sidebar">
          <div class="sidebar-header">
            <span class="sidebar-title">厂商列表</span>
            <span class="sidebar-count">{{ providers.length }}</span>
          </div>

          <div v-if="providers.length === 0" class="sidebar-empty">
            <Icon name="server" :size="24" />
            <span>暂无厂商数据</span>
          </div>

          <div v-else class="provider-list">
            <div
              v-for="p in providers"
              :key="p.id"
              class="provider-item"
              :class="{ active: selectedProviderId === p.id }"
              @click="selectProvider(p.id)"
            >
              <div class="provider-accent"></div>
              <div class="provider-avatar">
                <span>{{ p.name.charAt(0) }}</span>
              </div>
              <div class="provider-body">
                <div class="provider-name-row">
                  <span class="provider-name">{{ p.name }}</span>
                  <div class="provider-status" :class="providerStatus(p.id)">
                    <span class="status-dot"></span>
                  </div>
                </div>
                <div class="provider-sub">
                  <span class="provider-code">{{ p.code }}</span>
                  <span class="provider-sep">·</span>
                  <span class="provider-models">{{ (modelsMap[p.id] || []).length }} 模型</span>
                </div>
              </div>
              <button
                class="mini-btn edit"
                title="编辑 API 密钥/地址"
                @click.stop="openPatchProvider(p)"
              >
                <Icon name="edit" :size="12" />
              </button>
            </div>
          </div>
        </aside>

        <!-- 右侧：模型管理 -->
        <section class="config-main">
          <div v-if="selectedProvider" class="model-panel">
            <div class="panel-header">
              <div class="panel-title-area">
                <h2 class="panel-title">{{ selectedProvider.name }}</h2>
                <span class="panel-subtitle">
                  {{ selectedProvider.code }} · 共 {{ currentModels.length }} 个模型
                  <template v-if="selectedProvider.baseUrl">
                    <span class="panel-sep">·</span>
                    <span class="panel-url">{{ selectedProvider.baseUrl }}</span>
                  </template>
                </span>
              </div>
              <button class="action-btn primary" @click="openAddModel">
                <Icon name="plus" :size="13" />
                <span>添加模型</span>
              </button>
            </div>

            <div v-if="currentModels.length === 0" class="empty-state">
              <div class="empty-state-icon">
                <Icon name="box" :size="24" />
              </div>
              <span class="empty-state-text">暂无模型</span>
              <span class="empty-state-hint">点击上方「添加模型」按钮创建一个新的 AI 模型配置</span>
            </div>

            <div v-else class="model-list">
              <div
                v-for="m in currentModels"
                :key="m.id"
                class="model-card"
              >
                <div class="model-card-head">
                  <div class="model-card-name">
                    <span class="model-name">{{ m.name }}</span>
                    <span class="model-order">#{{ m.sortOrder }}</span>
                  </div>
                  <div class="model-card-badges">
                    <span v-if="m.isDefault" class="badge badge-primary">默认</span>
                    <span class="badge" :class="m.isEnabled ? 'badge-success' : 'badge-error'">{{
                      m.isEnabled ? '已启用' : '已禁用'
                    }}</span>
                    <span
                      v-if="testResults[m.id]"
                      class="badge"
                      :class="testResults[m.id].latencyMs >= 0 ? 'badge-success' : 'badge-error'"
                    >
                      <template v-if="testResults[m.id].latencyMs >= 0">
                        <Icon name="check" :size="10" />
                        {{ testResults[m.id].latencyMs }}ms
                      </template>
                      <template v-else>
                        <Icon name="close" :size="10" />
                        失败
                      </template>
                    </span>
                  </div>
                </div>
                <div class="model-card-actions">
                  <button
                    class="action-btn sm"
                    title="测试连通性"
                    :disabled="testingId === m.id"
                    @click="testModel(m.id)"
                  >
                    <Icon v-if="testingId === m.id" name="loader" :size="12" class="spin" />
                    <Icon v-else name="monitor" :size="12" />
                    <span>{{ testingId === m.id ? '测试中...' : '测试' }}</span>
                  </button>
                  <button class="action-btn sm" title="编辑" @click="openEditModel(m)">
                    <Icon name="edit" :size="12" />
                    <span>编辑</span>
                  </button>
                  <button class="action-btn sm danger" title="删除" @click="deleteModel(m.id)">
                    <Icon name="trash" :size="12" />
                    <span>删除</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <div class="empty-state-icon">
              <Icon name="server" :size="24" />
            </div>
            <span class="empty-state-text">选择一个厂商</span>
            <span class="empty-state-hint">从左侧列表中选择一个厂商以管理其 AI 模型</span>
          </div>
        </section>
      </div>
    </template>

    <!-- Provider Patch Modal (apiKey, baseUrl, sortOrder) -->
    <div v-if="showProviderPatch" class="modal-overlay" @click.self="showProviderPatch = false">
      <div class="modal-box">
        <h3>编辑厂商 — {{ patchingProvider?.name }}</h3>
        <div class="form-row">
          <label>API 地址</label>
          <input v-model="patchForm.baseUrl" placeholder="https://..." />
        </div>
        <div class="form-row">
          <label>API Key</label>
          <input v-model="patchForm.apiKey" type="password" placeholder="可选" />
        </div>
        <div class="form-row">
          <label>排序</label>
          <input v-model.number="patchForm.sortOrder" type="number" />
        </div>
        <div class="form-actions">
          <button class="action-btn" @click="showProviderPatch = false">取消</button>
          <button class="action-btn primary" @click="savePatch">保存</button>
        </div>
      </div>
    </div>

    <!-- Model Form Modal (only model CRUD remains) -->
    <div v-if="showModelForm" class="modal-overlay" @click.self="showModelForm = false">
      <div class="modal-box">
        <h3>{{ editingModel ? '编辑模型' : '添加模型' }}</h3>
        <div class="form-row">
          <label>模型名称</label>
          <input v-model="modelForm.name" placeholder="如 gpt-4o" />
        </div>
        <div class="form-row">
          <label>排序权重</label>
          <input v-model.number="modelForm.sortOrder" type="number" />
        </div>
        <div class="form-row">
          <label>API Key（可选）</label>
          <input v-model="modelForm.apiKey" type="password" placeholder="留空使用厂商密钥" />
        </div>
        <div class="form-row">
          <label>API 地址（可选）</label>
          <input v-model="modelForm.baseUrl" placeholder="留空使用厂商地址" />
        </div>
        <div class="form-row check-row">
          <label
            ><input
              v-model="modelForm.isEnabled"
              type="checkbox"
              :true-value="1"
              :false-value="0"
            />
            启用</label
          >
          <label
            ><input
              v-model="modelForm.isDefault"
              type="checkbox"
              :true-value="1"
              :false-value="0"
            />
            默认模型</label
          >
        </div>
        <div class="form-actions">
          <button class="action-btn" @click="showModelForm = false">取消</button>
          <button class="action-btn primary" @click="saveModel">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 配置页 · 主从分栏布局 ===== */
.model-view {
  padding: var(--space-lg) var(--space-xl);
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.config-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--space-lg);
  flex: 1;
  min-height: 0;
}

/* ===== 左侧厂商列表 ===== */
.config-sidebar {
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.sidebar-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  font-family: var(--font-code);
}

.sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  flex: 1;
  padding: var(--space-2xl) var(--space-lg);
  color: var(--text-tertiary);
  font-size: 13px;
}

.provider-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: var(--space-xs);
  gap: 2px;
}

/* 厂商列表项 */
.provider-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.provider-item:hover {
  background: var(--bg-hover);
}

.provider-item.active {
  background: var(--bg-elevated);
  box-shadow: inset 0 0 0 1px var(--border-accent);
}

.provider-accent {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  border-radius: 0 2px 2px 0;
  background: var(--accent-gradient-tech);
  transition: height var(--transition-fast);
}

.provider-item.active .provider-accent {
  height: 60%;
}

.provider-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-gradient);
  color: white;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: var(--glow-accent-sm);
}

.provider-body {
  flex: 1;
  min-width: 0;
}

.provider-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: 2px;
}

.provider-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-code);
}

.provider-code {
  color: var(--accent-primary);
  background: rgba(var(--accent-primary-rgb), 0.1);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
}

.provider-sep {
  color: var(--text-quaternary);
}

.provider-models {
  color: var(--text-quaternary);
}

/* 厂商状态指示 */
.provider-status {
  display: inline-flex;
  align-items: center;
}

.provider-status .status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-quaternary);
  flex-shrink: 0;
}

.provider-status.ok .status-dot {
  background: var(--accent-success);
  box-shadow: 0 0 6px var(--accent-success);
}

.provider-status.fail .status-dot {
  background: var(--accent-error);
  box-shadow: 0 0 6px var(--accent-error);
}

.provider-status.untested .status-dot {
  background: var(--text-quaternary);
}

.provider-item .mini-btn {
  opacity: 0;
  flex-shrink: 0;
}

.provider-item:hover .mini-btn {
  opacity: 1;
}

/* ===== 右侧模型管理 ===== */
.config-main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.config-main::-webkit-scrollbar {
  width: 8px;
}

.config-main::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: var(--radius-full);
}

.model-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.panel-title-area {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.panel-subtitle {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-code);
}

.panel-sep {
  color: var(--text-quaternary);
  margin: 0 2px;
}

.panel-url {
  color: var(--accent-cyan);
}

/* 模型卡片列表 */
.model-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.model-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-md) var(--space-lg);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
  animation: modelCardIn 0.3s var(--ease-out);
}

.model-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
  transform: translateX(2px);
}

.model-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.model-card-name {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.model-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-code);
}

.model-order {
  font-size: 11px;
  color: var(--text-quaternary);
  font-family: var(--font-code);
}

.model-card-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.model-card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border-color);
}

.model-card-actions .action-btn.sm {
  padding: 5px 12px;
  font-size: 12px;
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .config-layout {
    grid-template-columns: 1fr;
  }
  .config-sidebar {
    max-height: 240px;
  }
}

/* ===== 动画 ===== */
@keyframes modelCardIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spin {
  animation: spin 1s linear infinite;
}
</style>
