<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { providerApi, modelApi, chatApi } from '@renderer/api'
import { useChatStore } from '@renderer/stores'
import { getThemeMode, setThemeMode, getAiParams, setAiParams } from '@renderer/utils'
import type { AiProvider, AiModel, AiModelList, Session } from '@renderer/types'
import type { ThemeMode } from '@renderer/utils'
import ConfirmDialog from '@renderer/components/common/ConfirmDialog.vue'

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const chatStore = useChatStore()

const activeTab = ref('general')

const themeMode = ref<ThemeMode>('system')

const aiParams = ref(getAiParams())

// AI 参数变更自动持久化
watch(aiParams, () => setAiParams(aiParams.value), { deep: true })

const tabs = [
  { id: 'general', icon: '🎨', label: '通用' },
  { id: 'models', icon: '🤖', label: '模型' },
  { id: 'sessions', icon: '💬', label: '对话历史' },
  { id: 'about', icon: 'ℹ️', label: '关于' }
]

const themeOptions: { mode: ThemeMode; icon: string; label: string; desc: string; colors: string }[] = [
  { mode: 'light', icon: '☀️', label: '浅色', desc: '明亮清爽', colors: 'linear-gradient(135deg, #fef3c7, #fde68a, #fbbf24)' },
  { mode: 'dark', icon: '🌙', label: '深色', desc: '护眼沉浸', colors: 'linear-gradient(135deg, #312e81, #4338ca, #6366f1)' },
  { mode: 'system', icon: '🖥️', label: '跟随系统', desc: '自动切换', colors: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)' }
]

const sessions = ref<Session[]>([])
const providers = ref<AiProvider[]>([])
const modelsMap = ref<Record<number, AiModelList[]>>({})
const selectedProviderId = ref<number | null>(null)
const loading = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref<string | null>(null)

const selectedProviderModels = computed<AiModelList[]>(() => {
  if (!selectedProviderId.value) return []
  return modelsMap.value[selectedProviderId.value] || []
})

async function loadSessions(): Promise<void> {
  try {
    const res = await chatApi.listSessions()
    if (res.code === 200) sessions.value = res.data || []
  } catch {
    sessions.value = []
  }
}

async function loadProviderModels(): Promise<void> {
  try {
    const provRes = await providerApi.listAll()
    if (provRes.code === 200 && provRes.data?.length) {
      providers.value = provRes.data
      if (
        !selectedProviderId.value ||
        !provRes.data.find((p) => p.id === selectedProviderId.value)
      ) {
        selectedProviderId.value = provRes.data[0].id
      }
      // 加载选中厂商的模型
      if (selectedProviderId.value) {
        const modRes = await modelApi.listByProvider(selectedProviderId.value)
        if (modRes.code === 200) {
          modelsMap.value[selectedProviderId.value] = modRes.data || []
        }
      }
    }
  } catch {
    providers.value = []
  }
}

function loadTabData(tabId: string): void {
  loading.value = true
  const p: Promise<void>[] = []
  if (tabId === 'sessions') p.push(loadSessions())
  else if (tabId === 'models') p.push(loadProviderModels())
  Promise.all(p).finally(() => {
    loading.value = false
  })
}

function onTabChange(id: string): void {
  activeTab.value = id
  if (id === 'general') {
    themeMode.value = getThemeMode()
    aiParams.value = getAiParams()
    loading.value = false
  } else if (id === 'about') {
    loading.value = false
  } else {
    loadTabData(id)
  }
}

async function deleteSession(id: string): Promise<void> {
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}

async function confirmDeleteSession(): Promise<void> {
  const id = pendingDeleteId.value
  if (!id) return
  try {
    await chatApi.deleteSession(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
  } catch (e) {
    console.warn(e)
  } finally {
    showDeleteConfirm.value = false
    pendingDeleteId.value = null
  }
}

function cancelDeleteSession(): void {
  showDeleteConfirm.value = false
  pendingDeleteId.value = null
}

async function openSession(id: string): Promise<void> {
  await chatStore.switchSession(id)
  emit('close')
  router.push('/chat')
}

async function toggleModelEnabled(m: AiModelList): Promise<void> {
  try {
    await modelApi.update({ id: m.id, isEnabled: m.isEnabled ? 0 : 1 })
    m.isEnabled = m.isEnabled ? 0 : 1
  } catch (e) {
    console.warn(e)
  }
}

async function switchProvider(id: number): Promise<void> {
  selectedProviderId.value = id
  const modRes = await modelApi.listByProvider(id)
  if (modRes.code === 200) {
    modelsMap.value[id] = modRes.data || []
  }
}

// ---- Model CRUD ----
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
    await loadProviderModels()
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

// ---- Provider Patch ----
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
    await loadProviderModels()
  } catch (e) {
    console.warn(e)
  }
}

onMounted(() => {
  themeMode.value = getThemeMode()
})
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <h2 class="modal-title">设置</h2>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div class="tabs-sidebar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-item"
            :class="{ active: activeTab === tab.id }"
            @click="onTabChange(tab.id)"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <div class="tab-content">
          <!-- 加载中 -->
          <div v-if="loading" class="state-box">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>

          <!-- 通用：主题 + AI 快速参数 -->
          <div v-else-if="activeTab === 'general'" class="content-scroll">
            <!-- 主题 -->
            <div class="section-block">
              <div class="section-label">🎨 主题外观</div>
              <div class="theme-options">
                <button
                  v-for="opt in themeOptions"
                  :key="opt.mode"
                  class="theme-card"
                  :class="{ active: themeMode === opt.mode }"
                  @click="themeMode = opt.mode; setThemeMode(opt.mode)"
                >
                  <div class="theme-preview" :style="{ background: opt.colors }">
                    <span class="preview-icon">{{ opt.icon }}</span>
                  </div>
                  <div class="theme-info">
                    <span class="theme-name">{{ opt.label }}</span>
                    <span class="theme-desc">{{ opt.desc }}</span>
                  </div>
                  <div v-if="themeMode === opt.mode" class="check-mark">✓</div>
                </button>
              </div>
            </div>

            <!-- 系统提示词 -->
            <div class="section-block">
              <div class="section-label">📝 系统提示词</div>
              <textarea
                v-model="aiParams.systemPrompt"
                class="prompt-textarea"
                rows="4"
                placeholder="设置 AI 助手的角色和行为方式，例如：你是一个专业的编程助手..."
              ></textarea>
            </div>

            <!-- AI 参数 -->
            <div class="section-block">
              <div class="section-label">🤖 AI 参数</div>
              <div class="ai-params">
                <div class="param-row">
                  <div class="param-info">
                    <div class="param-name">温度 (Temperature)</div>
                    <div class="param-desc">控制输出随机性，越高越有创意</div>
                  </div>
                  <div class="param-control">
                    <input v-model.number="aiParams.temperature" type="range" min="0" max="2" step="0.1" />
                    <span class="param-value">{{ aiParams.temperature }}</span>
                  </div>
                </div>
                <div class="param-row">
                  <div class="param-info">
                    <div class="param-name">最大 Token 数</div>
                    <div class="param-desc">限制单次回复最大长度</div>
                  </div>
                  <div class="param-control">
                    <input v-model.number="aiParams.maxTokens" type="number" min="256" max="128000" step="1" class="param-input" />
                  </div>
                </div>
                <div class="param-row">
                  <div class="param-info">
                    <div class="param-name">Top-P 采样</div>
                    <div class="param-desc">核采样概率阈值</div>
                  </div>
                  <div class="param-control">
                    <input v-model.number="aiParams.topP" type="range" min="0" max="1" step="0.05" />
                    <span class="param-value">{{ aiParams.topP }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 模型管理 -->
          <div v-else-if="activeTab === 'models'" class="content-scroll">
            <!-- 厂商和模型 -->
            <div class="section-block">
              <div class="section-label">🏢 厂商与模型</div>
              <div v-if="providers.length === 0" class="state-box" style="height: auto; padding: 20px">
                <span>暂无厂商和模型</span>
              </div>
              <div v-else>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px">
                  <button
                    v-for="p in providers"
                    :key="p.id"
                    class="provider-tab"
                    :class="{ active: selectedProviderId === p.id }"
                    @click="switchProvider(p.id)"
                  >
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

            <!-- Model Form Modal (inline) -->
            <div v-if="showModelForm" class="modal-inner-overlay" @click.self="showModelForm = false">
              <div class="modal-inner-box">
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
                  <label><input v-model="modelForm.isEnabled" type="checkbox" :true-value="1" :false-value="0" /> 启用</label>
                  <label><input v-model="modelForm.isDefault" type="checkbox" :true-value="1" :false-value="0" /> 默认模型</label>
                </div>
                <div class="form-actions">
                  <button class="action-btn" @click="showModelForm = false">取消</button>
                  <button class="action-btn primary" @click="saveModel">保存</button>
                </div>
              </div>
            </div>

            <!-- Provider Patch Modal -->
            <div v-if="showProviderPatch" class="modal-inner-overlay" @click.self="showProviderPatch = false">
              <div class="modal-inner-box">
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
          </div>

          <!-- 对话历史 -->
          <div v-else-if="activeTab === 'sessions'" class="content-scroll">
            <div v-if="sessions.length === 0" class="state-box">
              <span style="opacity: 0.4; font-size: 32px">💬</span>
              <span>暂无对话</span>
            </div>
            <div v-else class="list">
              <div v-for="s in sessions" :key="s.id" class="list-item" @click="openSession(s.id)">
                <div class="list-item-main">
                  <div class="list-item-title">{{ s.title || '新对话' }}</div>
                  <div class="list-item-meta">{{ new Date(s.updateTime).toLocaleString() }}</div>
                </div>
                <button class="del-btn" title="删除" @click.stop="deleteSession(s.id)">✕</button>
              </div>
            </div>
          </div>

          <!-- 关于 -->
          <div v-else-if="activeTab === 'about'" class="content-scroll">
            <div class="about-section">
              <div class="about-logo">
                <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="28" stroke="url(#abtG)" stroke-width="2" fill="none" />
                  <path d="M22 32L29 39L42 25" stroke="url(#abtG)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                  <defs>
                    <linearGradient id="abtG" x1="0" y1="0" x2="64" y2="64">
                      <stop offset="0%" stop-color="var(--accent-primary)" />
                      <stop offset="100%" stop-color="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h3 class="about-name">Light Rain Agent</h3>
              <p class="about-version">v1.0.0</p>
              <div class="about-info">
                <div class="info-row"><span class="info-label">Electron</span><span class="info-value">39.2.6</span></div>
                <div class="info-row"><span class="info-label">Vue</span><span class="info-value">3.5.25</span></div>
                <div class="info-row"><span class="info-label">Node.js</span><span class="info-value">20.11.0</span></div>
              </div>
              <p class="about-desc">智能 AI 助手 · 雨夜中的微光</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ConfirmDialog
    v-if="showDeleteConfirm"
    title="删除会话"
    message="确定要删除这个会话吗？删除后不可恢复。"
    confirm-text="删除"
    cancel-text="取消"
    @confirm="confirmDeleteSession"
    @cancel="cancelDeleteSession"
  />
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayIn 0.25s ease;
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-container {
  width: 760px;
  max-width: 94vw;
  height: 580px;
  max-height: 86vh;
  background: var(--bg-elevated);
  backdrop-filter: blur(32px);
  border: 1px solid var(--border-strong);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-glass-lg);
  animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalIn {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-glass);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 50%;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.close-btn:hover {
  border-color: var(--accent-error);
  color: var(--accent-error);
  background: color-mix(in srgb, var(--accent-error) 10%, transparent);
  transform: rotate(90deg);
}

.modal-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.tabs-sidebar {
  width: 150px;
  flex-shrink: 0;
  padding: 12px 8px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-item.active {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.2), rgba(52, 211, 153, 0.1));
  color: var(--accent-primary);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.15);
}

.tab-item.page-link {
  opacity: 0.7;
  font-size: 12px;
}

.tab-item.page-link:hover {
  opacity: 1;
}

.tab-icon { font-size: 16px; }

.tab-label { font-weight: 600; }

/* ===== 系统提示词 ===== */
.prompt-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-glass);
  border-radius: 12px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  min-height: 90px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.prompt-textarea:focus {
  outline: none;
}

.prompt-textarea::placeholder {
  color: var(--text-quaternary);
}

.tab-content {
  flex: 1;
  overflow: hidden;
}

.content-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 16px 20px;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  color: var(--text-tertiary);
  font-size: 13px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-glass);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-item:hover {
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--accent-primary) 20%, transparent);
  transform: translateX(2px);
}

.list-item-main {
  flex: 1;
  min-width: 0;
}

.list-item-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-item-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 3px;
}

.del-btn {
  opacity: 0;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-item:hover .del-btn { opacity: 1; }

.del-btn:hover {
  background: color-mix(in srgb, var(--accent-error) 15%, transparent);
  color: var(--accent-error);
}

.badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  font-weight: 500;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent);
}

.provider-tab {
  padding: 8px 16px;
  border: 1px solid var(--border-glass);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.provider-tab:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}

.provider-tab.active {
  background: color-mix(in srgb, var(--accent-primary) 15%, transparent);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.15);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border-glass);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--accent-gradient);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

.action-btn.primary:hover:not(:disabled) {
  box-shadow: 0 6px 24px rgba(96, 165, 250, 0.4);
  filter: brightness(1.05);
}

.action-btn.sm {
  padding: 5px 12px;
  font-size: 12px;
}

.action-btn.danger {
  border-color: color-mix(in srgb, var(--accent-error) 30%, transparent);
  color: var(--accent-error);
}

.action-btn.danger:hover:not(:disabled) {
  border-color: var(--accent-error);
  background: color-mix(in srgb, var(--accent-error) 10%, transparent);
  box-shadow: 0 4px 16px rgba(248, 113, 113, 0.25);
}

.mini-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.mini-btn:hover { transform: scale(1.1); }
.mini-btn.edit:hover { background: color-mix(in srgb, var(--accent-primary) 15%, transparent); color: var(--accent-primary); }
.mini-btn.del:hover { background: color-mix(in srgb, var(--accent-error) 15%, transparent); color: var(--accent-error); }

.toggle-btn {
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
  flex-shrink: 0;
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

.config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item {
  padding: 14px 18px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-glass);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.config-item:hover {
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--accent-primary) 15%, transparent);
}

.config-key {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-primary);
  font-family: var(--font-code);
  margin-bottom: 6px;
}

.config-val {
  font-size: 13px;
  color: var(--text-secondary);
  word-break: break-all;
  white-space: pre-wrap;
  max-height: 80px;
  overflow-y: auto;
}

.modal-inner-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayIn 0.2s ease;
}

.modal-inner-box {
  width: 380px;
  max-width: 90vw;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--shadow-glass-lg);
  animation: modalIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  border: 1px solid var(--border-glass);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

/* ===== 通用区块 ===== */
.section-block {
  margin-bottom: 20px;
}

.section-block:last-child {
  margin-bottom: 0;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 14px;
}

/* ===== 主题卡片 ===== */
.theme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 10px;
  background: var(--bg-tertiary);
  border: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--text-primary);
}

.theme-card:hover {
  border-color: color-mix(in srgb, var(--accent-primary) 35%, transparent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.theme-card.active {
  border-color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  box-shadow: 0 8px 32px rgba(96, 165, 250, 0.2);
}

.theme-preview {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.theme-card:hover .theme-preview { transform: scale(1.1); }
.preview-icon { font-size: 18px; }

.theme-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.theme-name { font-size: 12px; font-weight: 600; }
.theme-desc { font-size: 11px; color: var(--text-tertiary); }

/* ===== AI 快速参数 ===== */
.ai-params {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-glass);
  border-radius: 10px;
  gap: 12px;
}

.param-info {
  flex: 1;
  min-width: 0;
}

.param-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.param-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.param-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.param-control input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100px;
  height: 5px;
  border-radius: 999px;
  background: var(--bg-quaternary);
  outline: none;
  cursor: pointer;
}

.param-control input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-gradient);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(96, 165, 250, 0.3);
}

.param-value {
  min-width: 32px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-code);
  padding: 2px 8px;
  background: var(--bg-quaternary);
  border-radius: 6px;
}

.param-input {
  width: 100px;
  padding: 6px 10px;
  background: var(--bg-quaternary);
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-code);
  text-align: center;
  outline: none;
}

.param-input:focus {
  outline: none;
}

/* ===== 配置项编辑 ===== */
.config-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.config-key-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-primary);
  font-family: var(--font-code);
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border-glass);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.edit-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}

.config-textarea {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-glass);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: var(--font-code);
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  min-height: 60px;
}

.config-textarea:focus {
  outline: none;
}

.config-edit-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ===== 关于 ===== */
.about-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px;
  text-align: center;
}

.about-logo {
  margin-bottom: 16px;
  filter: drop-shadow(0 0 20px var(--accent-glow));
}

.about-name {
  font-size: 20px;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 4px;
}

.about-version {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 20px;
}

.about-info {
  width: 100%;
  max-width: 240px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 13px;
  color: var(--text-primary);
  font-family: var(--font-code);
}

.about-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  letter-spacing: 0.03em;
}

.check-mark {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  background: var(--accent-gradient);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  font-weight: 700;
}

.form-row input:focus {
  outline: none;
}

.check-row {
  display: flex;
  gap: 20px;
}

.check-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
