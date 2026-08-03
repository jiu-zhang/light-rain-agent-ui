<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { planApi, type PlanTemplateVersion } from '@renderer/api/plan'
import type { PlanTemplate } from '@renderer/types'
import Icon from '@renderer/components/common/Icon.vue'

const templates = ref<PlanTemplate[]>([])
const loading = ref(false)
const errorMsg = ref('')

const formVisible = ref(false)
const editingId = ref<string | number | null>(null)
const formName = ref('')
const formDescription = ref('')
const formGoal = ref('')
const formSteps = ref('')
const formError = ref('')

const versionsVisible = ref(false)
const versionsLoading = ref(false)
const versions = ref<PlanTemplateVersion[]>([])
const versionsTarget = ref<PlanTemplate | null>(null)
const rollbackingId = ref<string | number | null>(null)

async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await planApi.listTemplates()
    templates.value = res.code === 200 ? res.data ?? [] : []
    if (res.code !== 200) errorMsg.value = res.message || '加载模板失败'
  } catch {
    templates.value = []
    errorMsg.value = '加载模板失败'
  } finally {
    loading.value = false
  }
}

/** 打开新建表单 */
function openCreate(): void {
  editingId.value = null
  formName.value = ''
  formDescription.value = ''
  formGoal.value = ''
  formSteps.value = JSON.stringify([{ name: '步骤一', description: '描述该步骤要做什么' }], null, 2)
  formError.value = ''
  formVisible.value = true
}

/** 打开编辑表单 */
function openEdit(t: PlanTemplate): void {
  editingId.value = t.id
  formName.value = t.name
  formDescription.value = t.description ?? ''
  formGoal.value = t.goal
  formSteps.value = formatSteps(t.stepsJson)
  formError.value = ''
  formVisible.value = true
}

function formatSteps(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

function parseSteps(): Array<Record<string, unknown>> | null {
  try {
    const parsed = JSON.parse(formSteps.value)
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

async function save(): Promise<void> {
  formError.value = ''
  if (!formName.value.trim()) {
    formError.value = '请输入模板名称'
    return
  }
  if (!formGoal.value.trim()) {
    formError.value = '请输入模板目标'
    return
  }
  const steps = parseSteps()
  if (!steps || steps.length === 0) {
    formError.value = '步骤需为合法的 JSON 数组'
    return
  }
  const payload: Partial<PlanTemplate> = {
    name: formName.value.trim(),
    description: formDescription.value.trim() || undefined,
    goal: formGoal.value.trim(),
    stepsJson: JSON.stringify(steps)
  }
  try {
    if (editingId.value === null) {
      await planApi.createTemplate(payload)
    } else {
      await planApi.updateTemplate(editingId.value, payload)
    }
    formVisible.value = false
    await load()
  } catch {
    formError.value = '保存失败，请检查后端服务'
  }
}

async function remove(t: PlanTemplate): Promise<void> {
  if (!window.confirm(`确认删除模板「${t.name}」？`)) return
  try {
    await planApi.deleteTemplate(t.id)
    await load()
  } catch {
    errorMsg.value = '删除失败'
  }
}

async function openVersions(t: PlanTemplate): Promise<void> {
  versionsTarget.value = t
  versionsVisible.value = true
  versionsLoading.value = true
  versions.value = []
  try {
    const res = await planApi.listTemplateVersions(t.id)
    versions.value = res.code === 200 ? res.data ?? [] : []
  } catch {
    versions.value = []
  } finally {
    versionsLoading.value = false
  }
}

async function rollback(v: PlanTemplateVersion): Promise<void> {
  if (!versionsTarget.value) return
  if (!window.confirm(`确认将模板「${v.name}」回滚到 v${v.version}？当前内容将被保存为新版本。`)) return
  rollbackingId.value = v.id
  try {
    await planApi.rollbackTemplate(versionsTarget.value.id, v.id)
    versionsVisible.value = false
    await load()
  } catch {
    errorMsg.value = '回滚失败'
  } finally {
    rollbackingId.value = null
  }
}

function formatTime(t?: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').slice(0, 16)
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">
        <Icon name="git-branch" :size="24" class="title-icon" />
        计划模板
      </h1>
      <p class="page-desc">保存常用计划，对话中开启「计划」模式时复用</p>
    </div>
    <div class="page-content">
      <div class="toolbar">
        <button class="primary-btn" @click="openCreate">
          <Icon name="plus" :size="15" />
          新建模板
        </button>
      </div>

      <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

      <div v-if="loading" class="empty-hint">
        <Icon name="loader" :size="20" class="spin" />
        加载中...
      </div>
      <div v-else-if="templates.length === 0" class="empty-hint">暂无模板，点击「新建模板」创建</div>
      <div v-else class="template-grid">
        <div v-for="t in templates" :key="t.id" class="template-card">
          <div class="template-head">
            <span class="template-name">{{ t.name }}</span>
            <div class="template-actions">
              <button class="icon-btn" title="历史版本" @click="openVersions(t)">
                <Icon name="history" :size="14" />
              </button>
              <button class="icon-btn" title="编辑" @click="openEdit(t)">
                <Icon name="edit" :size="14" />
              </button>
              <button class="icon-btn danger" title="删除" @click="remove(t)">
                <Icon name="trash" :size="14" />
              </button>
            </div>
          </div>
          <p v-if="t.description" class="template-desc">{{ t.description }}</p>
          <p class="template-goal" :title="t.goal">{{ t.goal }}</p>
          <div class="template-steps">{{ formatSteps(t.stepsJson) }}</div>
          <div class="template-meta">
            <span>更新于 {{ t.updateTime ? t.updateTime.replace('T', ' ').slice(0, 16) : '-' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建 / 编辑弹窗 -->
    <div v-if="formVisible" class="modal-mask" @click.self="formVisible = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ editingId === null ? '新建模板' : '编辑模板' }}</h3>
          <button class="icon-btn" @click="formVisible = false">
            <Icon name="x" :size="16" />
          </button>
        </div>
        <div class="modal-body">
          <label class="field">
            <span class="field-label">名称</span>
            <input v-model="formName" class="field-input" placeholder="例如：周报生成" />
          </label>
          <label class="field">
            <span class="field-label">描述</span>
            <input v-model="formDescription" class="field-input" placeholder="模板用途说明（可选）" />
          </label>
          <label class="field">
            <span class="field-label">目标（支持占位符，如 {date}、{name}）</span>
            <textarea v-model="formGoal" class="field-input field-area" rows="2" placeholder="例如：帮我生成 {date} 的周报，总结本周工作并列出下周计划" />
          </label>
          <label class="field">
            <span class="field-label">步骤（JSON 数组，每项含 name/description）</span>
            <textarea v-model="formSteps" class="field-input field-code" rows="8" spellcheck="false" />
          </label>
          <div v-if="formError" class="form-error">{{ formError }}</div>
        </div>
        <div class="modal-foot">
          <button class="ghost-btn" @click="formVisible = false">取消</button>
          <button class="primary-btn" @click="save">保存</button>
        </div>
      </div>
    </div>

    <!-- 历史版本弹窗 -->
    <div v-if="versionsVisible" class="modal-mask" @click.self="versionsVisible = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ versionsTarget?.name }} · 历史版本</h3>
          <button class="icon-btn" @click="versionsVisible = false">
            <Icon name="x" :size="16" />
          </button>
        </div>
        <div class="modal-body">
          <div v-if="versionsLoading" class="empty-hint">
            <Icon name="loader" :size="18" class="spin" />
            加载中...
          </div>
          <div v-else-if="versions.length === 0" class="empty-hint">暂无历史版本</div>
          <div v-else class="version-list">
            <div v-for="v in versions" :key="v.id" class="version-item">
              <div class="version-main">
                <span class="version-badge">v{{ v.version }}</span>
                <div class="version-info">
                  <div class="version-name">{{ v.name }}</div>
                  <div class="version-meta">
                    {{ formatTime(v.createTime) }} · {{ (v.goal || '').slice(0, 40) }}{{ (v.goal || '').length > 40 ? '…' : '' }}
                  </div>
                </div>
              </div>
              <button
                class="ghost-btn sm"
                :disabled="rollbackingId === v.id"
                @click="rollback(v)"
              >
                <Icon v-if="rollbackingId === v.id" name="loader" :size="12" class="spin" />
                回滚
              </button>
            </div>
          </div>
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
.page-content {
  max-width: 860px;
}
.toolbar {
  margin-bottom: 16px;
}
.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent-gradient);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}
.primary-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
.ghost-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all var(--transition-fast);
}
.ghost-btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.error-banner {
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent-error) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-error) 30%, transparent);
  color: var(--accent-error);
  font-size: 13px;
}
.empty-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 40px 0;
  color: var(--text-tertiary);
  font-size: 13px;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}
.template-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.template-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.template-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.template-actions {
  display: flex;
  gap: 4px;
}
.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.icon-btn.danger:hover {
  background: color-mix(in srgb, var(--accent-error) 12%, transparent);
  color: var(--accent-error);
}
.template-desc {
  font-size: 12px;
  color: var(--text-tertiary);
}
.template-goal {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.template-steps {
  font-family: var(--font-code);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-quaternary);
  background: var(--bg-glass);
  border-radius: 6px;
  padding: 8px;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.template-meta {
  font-size: 11px;
  color: var(--text-quaternary);
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  width: 520px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}
.modal-head h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.modal-body {
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}
.field-input {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--transition-fast);
}
.field-input:focus {
  border-color: var(--border-accent);
}
.field-area {
  resize: vertical;
}
.field-code {
  font-family: var(--font-code);
  resize: vertical;
}
.form-error {
  font-size: 12px;
  color: var(--accent-error);
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid var(--border-color);
}
.version-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-card);
}
.version-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.version-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
  color: var(--accent-primary);
  flex-shrink: 0;
}
.version-info {
  min-width: 0;
}
.version-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.version-meta {
  font-size: 11px;
  color: var(--text-quaternary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ghost-btn.sm {
  padding: 5px 12px;
  font-size: 12px;
  flex-shrink: 0;
}
.ghost-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
