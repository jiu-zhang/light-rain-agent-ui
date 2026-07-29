<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { configApi } from '@renderer/api'

const configs = ref<Record<string, string>>({})
const loading = ref(false)
const saving = ref(false)
const editingKey = ref<string | null>(null)
const editingValue = ref('')
const showAddForm = ref(false)
const addKey = ref('')
const addValue = ref('')
const addValueRef = ref<HTMLTextAreaElement | null>(null)

async function loadConfigs(): Promise<void> {
  loading.value = true
  try {
    const res = await configApi.list()
    if (res.code === 200) configs.value = res.data || {}
  } catch (e) {
    console.error('加载配置失败:', e)
  } finally {
    loading.value = false
  }
}

function startEdit(key: string, value: string): void {
  editingKey.value = key
  editingValue.value = value
}

function cancelEdit(): void {
  editingKey.value = null
  editingValue.value = ''
}

async function saveConfig(): Promise<void> {
  if (!editingKey.value) return
  saving.value = true
  try {
    const res = await configApi.save({ [editingKey.value]: editingValue.value })
    if (res.code === 200) {
      configs.value[editingKey.value] = editingValue.value
      cancelEdit()
    }
  } catch (e) {
    console.error('保存配置失败:', e)
  } finally {
    saving.value = false
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    saveConfig()
  }
}

async function addConfig(): Promise<void> {
  if (!addKey.value.trim()) return
  saving.value = true
  try {
    const res = await configApi.save({ [addKey.value.trim()]: addValue.value })
    if (res.code === 200) {
      configs.value[addKey.value.trim()] = addValue.value
      addKey.value = ''
      addValue.value = ''
      showAddForm.value = false
    }
  } catch (e) {
    console.error('添加配置失败:', e)
  } finally {
    saving.value = false
  }
}

function startAdd(): void {
  showAddForm.value = true
  addKey.value = ''
  addValue.value = ''
  // 在下一帧聚焦 textarea
  setTimeout(() => addValueRef.value?.focus(), 50)
}

function cancelAdd(): void {
  showAddForm.value = false
  addKey.value = ''
  addValue.value = ''
}

onMounted(() => loadConfigs())
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <div class="header-content">
        <h1 class="view-title">⚙️ 配置管理</h1>
        <p class="view-desc">管理系统提示词、温度等 AI 配置</p>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="loadConfigs">
          <span>🔄</span>
          <span>刷新</span>
        </button>
        <button class="action-btn primary" @click="startAdd">
          <span>＋</span> <span>新增</span>
        </button>
      </div>
    </div>

    <div class="content-area">
      <div v-if="loading" class="loading-state">
        <div class="loader"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="Object.keys(configs).length === 0" class="empty-state">
        <div class="empty-icon">⚙️</div>
        <div class="empty-text">暂无配置</div>
        <div class="empty-hint">AI 配置项为空</div>
      </div>

      <div v-else class="config-list">
        <!-- 新增配置表单 -->
        <div v-if="showAddForm" class="config-item add-form">
          <div class="add-form-row">
            <input v-model="addKey" class="add-key-input" placeholder="配置键名 (如 system.prompt)" @keydown.enter="addValueRef?.focus()" />
          </div>
          <textarea v-model="addValue" ref="addValueRef" class="cfg-textarea" rows="3" placeholder="配置值"></textarea>
          <div class="edit-actions">
            <button class="action-btn sm" @click="cancelAdd">取消</button>
            <button class="action-btn primary sm" :disabled="saving || !addKey.trim()" @click="addConfig">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
        </div>

        <div v-for="(value, key) in configs" :key="key" class="config-item">
          <div v-if="editingKey !== key" class="config-display">
            <div class="config-header">
              <span class="config-key">{{ key }}</span>
              <div class="config-actions">
                <button class="edit-btn" @click="startEdit(key, value)">✎ 编辑</button>
              </div>
            </div>
            <div class="config-value">{{ value }}</div>
          </div>

          <div v-else class="config-edit">
            <div class="edit-header">
              <span class="config-key">{{ key }}</span>
              <span class="edit-hint">编辑中 · Ctrl+Enter 保存</span>
            </div>
            <textarea
              v-model="editingValue"
              class="cfg-textarea"
              rows="4"
              placeholder="输入配置值..."
              @keydown="handleKeydown"
            ></textarea>
            <div class="edit-actions">
              <button class="action-btn sm" @click="cancelEdit">取消</button>
              <button class="action-btn primary sm" :disabled="saving" @click="saveConfig">
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: var(--space-xl) var(--space-2xl);
  height: 100%;
  overflow-y: auto;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: 12px;
}

.header-content {
  flex: 1;
  min-width: 0;
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
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid var(--border-glass);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: 0 2px 8px rgba(96, 165, 250, 0.15);
}

.action-btn.primary {
  background: var(--accent-gradient);
  color: white;
  border-color: transparent;
  box-shadow: 0 2px 8px rgba(96, 165, 250, 0.25);
}

.action-btn.primary:hover {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.35);
  filter: brightness(1.05);
}

.action-btn.sm {
  padding: 5px 14px;
  font-size: 12px;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.config-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 18px 22px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.config-item.add-form {
  border-style: dashed;
  border-color: var(--border-accent);
}

.config-item:hover {
  border-color: var(--border-accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.config-item.add-form:hover {
  transform: none;
  box-shadow: none;
}

.config-item:hover .config-value {
  background: var(--bg-tertiary);
}

.config-display {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.config-key {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent-primary);
  font-family: var(--font-code);
  letter-spacing: 0.02em;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--border-glass);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.edit-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  transform: scale(1.05);
}

.edit-icon {
  font-size: 13px;
}

.config-value {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.6;
  padding: 12px 14px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  transition: background var(--transition-fast);
  font-family: var(--font-code);
}

.config-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.edit-hint {
  font-size: 11px;
  color: var(--accent-primary);
  padding: 2px 8px;
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  border-radius: var(--radius-full);
}

.cfg-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-code);
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
  min-height: 80px;
}

.cfg-textarea:focus {
  outline: none;
}

.edit-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-top: 4px;
}

/* 新增配置表单 */
.add-form-row {
  margin-bottom: 10px;
}

.add-key-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-code);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.add-key-input:focus {
  outline: none;
}

.config-actions {
  display: flex;
  gap: 6px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: 64px 32px;
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 56px;
  opacity: 0.5;
  filter: grayscale(0.5);
}

.empty-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 13px;
  opacity: 0.7;
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
</style>
