<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { providerApi } from '@renderer/api/provider'
import { modelApi } from '@renderer/api/model'
import type { AiProvider, AiModel, AiModelList } from '@renderer/types'

const providers = ref<AiProvider[]>([])
const modelsMap = ref<Record<number, AiModelList[]>>({})
const selectedProviderId = ref<number | null>(null)
const loading = ref(false)

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
      await modelApi.update({ ...modelForm.value, id: editingModel.value.id })
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
  <div class="view-container">
    <div class="view-header">
      <div class="header-content">
        <h1 class="view-title">🏢 模型配置</h1>
        <p class="view-desc">管理 AI 模型（厂商数据由系统初始化）</p>
      </div>
      <button class="action-btn" @click="loadAll"><span>🔄</span> <span>刷新</span></button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loader"></div>
      <span>加载中...</span>
    </div>

    <template v-else>
      <!-- Provider Cards (read-only) -->
      <div class="provider-section">
        <h2 class="section-title">厂商列表</h2>
        <div v-if="providers.length === 0" class="empty-box">
          <span>暂无厂商数据</span>
        </div>
        <div v-else class="card-grid">
          <div
            v-for="p in providers"
            :key="p.id"
            class="provider-card"
            :class="{ active: selectedProviderId === p.id }"
            @click="selectProvider(p.id)"
          >
            <div class="card-glow"></div>
            <div class="card-main">
              <div class="card-title">{{ p.name }}</div>
              <div class="card-code">{{ p.code }}</div>
              <div v-if="p.baseUrl" class="card-url">{{ p.baseUrl }}</div>
            </div>
            <div class="card-meta">
              <span class="model-count">{{ (modelsMap[p.id] || []).length }} 模型</span>
              <button
                class="mini-btn edit"
                title="编辑 API 密钥/地址"
                @click.stop="openPatchProvider(p)"
              >
                ✎
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Model List for selected provider -->
      <div v-if="selectedProvider" class="model-section">
        <div class="section-header">
          <h2 class="section-title">{{ selectedProvider.name }} - 模型列表</h2>
          <button class="action-btn primary sm" @click="openAddModel">
            <span>＋</span> <span>添加模型</span>
          </button>
        </div>

        <div v-if="currentModels.length === 0" class="empty-box">
          <span>暂无模型，请添加</span>
        </div>
        <div v-else class="model-table">
          <div v-for="m in currentModels" :key="m.id" class="model-row">
            <div class="model-info">
              <div class="model-name-group">
                <span class="model-name">{{ m.name }}</span>
                <span class="model-order">#{{ m.sortOrder }}</span>
              </div>
              <div class="model-tags">
                <span v-if="m.isDefault" class="badge default">默认</span>
                <span class="badge" :class="m.isEnabled ? 'on' : 'off'">{{ m.isEnabled ? '已启用' : '已禁用' }}</span>
              </div>
            </div>
            <div class="model-actions">
              <button class="action-btn sm" title="编辑" @click="openEditModel(m)">✎ 编辑</button>
              <button class="action-btn sm danger" title="删除" @click="deleteModel(m.id)">✕ 删除</button>
            </div>
          </div>
        </div>
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
.view-container {
  padding: var(--space-lg) var(--space-xl);
  height: 100%;
  overflow-y: auto;
}

.view-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.view-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.view-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border: 1px solid var(--border-glass);
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.2);
  transform: translateY(-1px);
}

.action-btn.primary {
  background: var(--accent-gradient);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

.action-btn.primary:hover {
  box-shadow: 0 6px 24px rgba(96, 165, 250, 0.4);
  filter: brightness(1.05);
}

.action-btn.sm {
  padding: 6px 14px;
  font-size: 12px;
}

.action-btn.danger {
  border-color: color-mix(in srgb, var(--accent-error) 30%, transparent);
  color: var(--accent-error);
}

.action-btn.danger:hover {
  border-color: var(--accent-error);
  background: color-mix(in srgb, var(--accent-error) 10%, transparent);
  box-shadow: 0 4px 16px rgba(248, 113, 113, 0.25);
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 14px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.provider-section {
  margin-bottom: 32px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-md);
}

.provider-card {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-md);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.provider-card:hover {
  border-color: var(--border-accent);
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.provider-card.active {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 6%, transparent);
  box-shadow: 0 8px 32px rgba(96, 165, 250, 0.2);
}

.provider-card.active .card-glow {
  opacity: 1;
}

.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-gradient);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.card-main {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.card-code {
  font-size: 11px;
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  margin-bottom: 8px;
  font-family: var(--font-code);
}

.card-url {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-code);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}

.model-count {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.model-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-card);
  backdrop-filter: var(--blur-sm);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.model-row:hover {
  background: var(--bg-glass-hover);
  border-color: var(--border-accent);
  transform: translateX(2px);
  box-shadow: var(--shadow-md);
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.model-name-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.model-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-code);
}

.model-order {
  font-size: 11px;
  color: var(--text-quaternary);
  font-family: var(--font-code);
}

.model-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}

.badge {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.badge.default {
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  border: 1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent);
}

.badge.on {
  background: color-mix(in srgb, var(--accent-success) 12%, transparent);
  color: var(--accent-success);
  border: 1px solid color-mix(in srgb, var(--accent-success) 30%, transparent);
}

.badge.off {
  background: color-mix(in srgb, var(--accent-error) 12%, transparent);
  color: var(--accent-error);
  border: 1px solid color-mix(in srgb, var(--accent-error) 30%, transparent);
}

.model-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.mini-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-glass);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.mini-btn.edit:hover {
  background: color-mix(in srgb, var(--accent-primary) 15%, transparent);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.3);
}

.mini-btn.del:hover {
  background: color-mix(in srgb, var(--accent-error) 15%, transparent);
  border-color: var(--accent-error);
  color: var(--accent-error);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(248, 113, 113, 0.3);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayIn 0.2s ease;
}

@keyframes overlayIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-box {
  width: 480px;
  max-width: 92vw;
  background: var(--bg-elevated);
  backdrop-filter: var(--blur-xl);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  padding: 28px;
  box-shadow: var(--shadow-glass-lg);
  animation: modalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-box h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 24px;
  letter-spacing: -0.01em;
}

.form-row {
  margin-bottom: 16px;
}

.form-row label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.form-row input {
  width: 100%;
  padding: 11px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

.form-row input:focus {
  outline: none;
}

.check-row {
  display: flex;
  gap: 24px;
}

.check-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-2xl);
  color: var(--text-tertiary);
}

.loader {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-box {
  text-align: center;
  padding: 48px 32px;
  color: var(--text-tertiary);
  font-size: 14px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-sm);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-color);
}
</style>
