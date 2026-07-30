<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { providerApi } from '@renderer/api/provider'
import { modelApi } from '@renderer/api/model'
import type { AiProvider, AiModel, AiModelList } from '@renderer/types'

const providers = ref<AiProvider[]>([])
const modelsMap = ref<Record<number, AiModelList[]>>({})
const selectedProviderId = ref<number | null>(null)

const selectedProviderModels = computed<AiModelList[]>(() => {
  if (!selectedProviderId.value) return []
  return modelsMap.value[selectedProviderId.value] || []
})

async function loadProviderModels(): Promise<void> {
  try {
    const provRes = await providerApi.listAll()
    if (provRes.code === 200 && provRes.data?.length) {
      providers.value = provRes.data
      if (!selectedProviderId.value || !provRes.data.find((p) => p.id === selectedProviderId.value)) {
        selectedProviderId.value = provRes.data[0].id
      }
      if (selectedProviderId.value) {
        const modRes = await modelApi.listByProvider(selectedProviderId.value)
        if (modRes.code === 200) modelsMap.value[selectedProviderId.value] = modRes.data || []
      }
    }
  } catch { providers.value = [] }
}

async function switchProvider(id: number): Promise<void> {
  selectedProviderId.value = id
  const modRes = await modelApi.listByProvider(id)
  if (modRes.code === 200) modelsMap.value[id] = modRes.data || []
}

async function toggleModelEnabled(m: AiModelList): Promise<void> {
  try {
    await modelApi.update({ id: m.id, isEnabled: m.isEnabled ? 0 : 1 })
    m.isEnabled = m.isEnabled ? 0 : 1
  } catch (e) { console.warn(e) }
}

// Model CRUD
const showModelForm = ref(false)
const editingModel = ref<AiModel | null>(null)
const modelForm = ref({ name: '', isDefault: 0, isEnabled: 1, sortOrder: 0, apiKey: '', baseUrl: '' })

function openAddModel(): void {
  if (!selectedProviderId.value) return
  editingModel.value = null
  modelForm.value = { name: '', isDefault: 0, isEnabled: 1, sortOrder: 0, apiKey: '', baseUrl: '' }
  showModelForm.value = true
}

function openEditModel(m: AiModel): void {
  editingModel.value = m
  modelForm.value = {
    name: m.name, isDefault: m.isDefault, isEnabled: m.isEnabled,
    sortOrder: m.sortOrder || 0, apiKey: m.apiKey || '', baseUrl: m.baseUrl || ''
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
    await loadProviderModels()
  } catch (e) { console.warn(e) }
}

async function deleteModel(id: number): Promise<void> {
  try {
    await modelApi.delete(id)
    if (selectedProviderId.value && modelsMap.value[selectedProviderId.value]) {
      modelsMap.value[selectedProviderId.value] = modelsMap.value[selectedProviderId.value].filter((m) => m.id !== id)
    }
  } catch (e) { console.warn(e) }
}

// Provider Patch
const showProviderPatch = ref(false)
const patchingProvider = ref<AiProvider | null>(null)
const patchForm = ref({ apiKey: '', baseUrl: '', sortOrder: 0 })

function openPatchProvider(p: AiProvider): void {
  patchingProvider.value = p
  patchForm.value = { apiKey: p.apiKey || '', baseUrl: p.baseUrl || '', sortOrder: p.sortOrder || 0 }
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
    await loadProviderModels()
  } catch (e) { console.warn(e) }
}

onMounted(loadProviderModels)
</script>

<template>
  <div class="section-block">
    <div class="section-label">🏢 厂商与模型</div>
    <div v-if="providers.length === 0" class="state-box" style="height: auto; padding: 20px">
      <span>暂无厂商和模型</span>
    </div>
    <div v-else>
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px">
        <button v-for="p in providers" :key="p.id" class="provider-tab" :class="{ active: selectedProviderId === p.id }" @click="switchProvider(p.id)">
          {{ p.name }}
        </button>
      </div>
      <div style="display: flex; gap: 6px; margin-bottom: 12px">
        <button class="action-btn sm" :disabled="!selectedProviderId" @click="openAddModel">＋ 添加模型</button>
        <button class="action-btn sm" :disabled="!selectedProviderId" @click="openPatchProvider(providers.find((p) => p.id === selectedProviderId)!)">✎ 编辑厂商</button>
      </div>
      <div v-if="selectedProviderModels.length === 0" class="state-box" style="height: auto; padding: 16px">
        <span style="font-size: 13px">该厂商暂无模型</span>
      </div>
      <div v-else class="list">
        <div v-for="m in selectedProviderModels" :key="m.id" class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">{{ m.name }}</div>
            <div class="list-item-meta">排序: {{ m.sortOrder }}</div>
          </div>
          <button class="action-btn sm" title="编辑" @click="openEditModel(m)">✎ 编辑</button>
          <button class="action-btn sm danger" title="删除" @click="deleteModel(m.id)">✕ 删除</button>
          <button class="toggle-btn" :class="m.isEnabled ? 'on' : 'off'" @click="toggleModelEnabled(m)">{{ m.isEnabled ? '已启用' : '已禁用' }}</button>
          <span v-if="m.isDefault" class="badge">默认</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Model Form -->
  <div v-if="showModelForm" class="modal-inner-overlay" @click.self="showModelForm = false">
    <div class="modal-inner-box">
      <h3>{{ editingModel ? '编辑模型' : '添加模型' }}</h3>
      <div class="form-row"><label>模型名称</label><input v-model="modelForm.name" placeholder="如 gpt-4o" /></div>
      <div class="form-row"><label>排序权重</label><input v-model.number="modelForm.sortOrder" type="number" /></div>
      <div class="form-row"><label>API Key（可选）</label><input v-model="modelForm.apiKey" type="password" placeholder="留空使用厂商密钥" /></div>
      <div class="form-row"><label>API 地址（可选）</label><input v-model="modelForm.baseUrl" placeholder="留空使用厂商地址" /></div>
      <div class="form-row check-row">
        <label><input v-model="modelForm.isEnabled" type="checkbox" :true-value="1" :false-value="0" /> 启用</label>
        <label><input v-model="modelForm.isDefault" type="checkbox" :true-value="1" :false-value="0" /> 默认模型</label>
      </div>
      <div class="form-actions">
        <button class="action-btn" @click="showModelForm = false">取消</button>
        <button class="action-btn primary" @click="saveModel">保存</button>
      </div>
    </div>
  </div>

  <!-- Provider Patch -->
  <div v-if="showProviderPatch" class="modal-inner-overlay" @click.self="showProviderPatch = false">
    <div class="modal-inner-box">
      <h3>编辑厂商 — {{ patchingProvider?.name }}</h3>
      <div class="form-row"><label>API 地址</label><input v-model="patchForm.baseUrl" placeholder="https://..." /></div>
      <div class="form-row"><label>API Key</label><input v-model="patchForm.apiKey" type="password" placeholder="可选" /></div>
      <div class="form-row"><label>排序</label><input v-model.number="patchForm.sortOrder" type="number" /></div>
      <div class="form-actions">
        <button class="action-btn" @click="showProviderPatch = false">取消</button>
        <button class="action-btn primary" @click="savePatch">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-block { margin-bottom: 20px; }
.section-block:last-child { margin-bottom: 0; }
.section-label { font-size: 12px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-tertiary); font-size: 13px; }
.provider-tab { padding: 8px 16px; border: 1px solid var(--border-glass); background: var(--bg-tertiary); color: var(--text-secondary); font-size: 13px; font-weight: 500; border-radius: 999px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.provider-tab:hover { border-color: var(--accent-primary); color: var(--accent-primary); background: color-mix(in srgb, var(--accent-primary) 8%, transparent); }
.provider-tab.active { background: color-mix(in srgb, var(--accent-primary) 15%, transparent); border-color: var(--accent-primary); color: var(--accent-primary); box-shadow: 0 4px 12px rgba(96, 165, 250, 0.15); }
.action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--border-glass); background: var(--bg-tertiary); color: var(--text-secondary); font-size: 13px; font-weight: 500; border-radius: 10px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.action-btn:hover:not(:disabled) { border-color: var(--accent-primary); color: var(--accent-primary); background: color-mix(in srgb, var(--accent-primary) 8%, transparent); transform: translateY(-1px); }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn.primary { background: var(--accent-gradient); border-color: transparent; color: white; box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3); }
.action-btn.primary:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(96, 165, 250, 0.4); filter: brightness(1.05); }
.action-btn.sm { padding: 5px 12px; font-size: 12px; }
.action-btn.danger { border-color: color-mix(in srgb, var(--accent-error) 30%, transparent); color: var(--accent-error); }
.action-btn.danger:hover:not(:disabled) { border-color: var(--accent-error); background: color-mix(in srgb, var(--accent-error) 10%, transparent); box-shadow: 0 4px 16px rgba(248, 113, 113, 0.25); }
.list { display: flex; flex-direction: column; gap: 6px; }
.list-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-glass); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.list-item:hover { background: var(--bg-hover); border-color: color-mix(in srgb, var(--accent-primary) 20%, transparent); }
.list-item-main { flex: 1; min-width: 0; }
.list-item-title { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.list-item-meta { font-size: 12px; color: var(--text-tertiary); margin-top: 3px; }
.toggle-btn { font-size: 11px; padding: 4px 12px; border-radius: 999px; border: 1px solid; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); font-weight: 500; flex-shrink: 0; }
.toggle-btn.on { background: color-mix(in srgb, var(--accent-success) 12%, transparent); color: var(--accent-success); border-color: color-mix(in srgb, var(--accent-success) 30%, transparent); }
.toggle-btn.off { background: color-mix(in srgb, var(--accent-error) 12%, transparent); color: var(--accent-error); border-color: color-mix(in srgb, var(--accent-error) 30%, transparent); }
.badge { font-size: 11px; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--accent-primary) 12%, transparent); color: var(--accent-primary); font-weight: 500; flex-shrink: 0; border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent); }
.modal-inner-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); z-index: 300; display: flex; align-items: center; justify-content: center; animation: overlayIn 0.2s ease; }
.modal-inner-box { width: 380px; max-width: 90vw; background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-glass-lg); animation: modalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-inner-box h3 { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 18px; }
@keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
.form-row { margin-bottom: 14px; }
.form-row label { display: block; font-size: 12px; font-weight: 500; color: var(--text-tertiary); margin-bottom: 6px; }
.form-row input { width: 100%; padding: 10px 14px; background: var(--bg-tertiary); border: 1px solid var(--border-glass); border-radius: 10px; color: var(--text-primary); font-size: 13px; outline: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-sizing: border-box; }
.form-row input:focus { outline: none; }
.check-row { display: flex; gap: 20px; }
.check-row label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); cursor: pointer; }
.form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
</style>
