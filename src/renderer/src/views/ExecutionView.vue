<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { planApi, type ExecutionSnapshot } from '@renderer/api/plan'
import type { ExecutionRecord } from '@renderer/types'
import Icon from '@renderer/components/common/Icon.vue'

const records = ref<ExecutionRecord[]>([])
const loading = ref(false)
const selected = ref<ExecutionRecord | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const expandedThinkActs = ref<Set<string | number>>(new Set())
const snapshots = ref<ExecutionSnapshot[]>([])
const snapshotBusy = ref(false)

/** 创建快照（挂起当前执行上下文） */
async function createSnapshot(): Promise<void> {
  if (!selected.value || snapshotBusy.value) return
  snapshotBusy.value = true
  try {
    await planApi.createSnapshot(selected.value.id)
    await loadSnapshots()
  } catch {
    // 已由拦截器统一提示
  } finally {
    snapshotBusy.value = false
  }
}

/** 加载当前会话的快照列表 */
async function loadSnapshots(): Promise<void> {
  if (!selected.value?.sessionId) return
  try {
    const res = await planApi.listSnapshots(selected.value.sessionId)
    snapshots.value = res.code === 200 ? res.data ?? [] : []
  } catch {
    snapshots.value = []
  }
}

async function deleteSnapshot(snapshotId: string | number): Promise<void> {
  try {
    await planApi.deleteSnapshot(snapshotId)
    snapshots.value = snapshots.value.filter((s) => s.id !== snapshotId)
  } catch {
    // 已由拦截器统一提示
  }
}

function snapshotStateText(state: string): string {
  return state === 'SAVED' ? '已保存' : state === 'SIMULATED' ? '已模拟' : state === 'CONTINUED' ? '已继续' : state
}

/** 展开/收起某个 think-act */
function toggleThinkAct(id: string | number): void {
  const next = new Set(expandedThinkActs.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedThinkActs.value = next
}

/** 展开/收起工具结果 */
const expandedTools = ref<Set<string | number>>(new Set())
function toggleTool(id: string | number): void {
  const next = new Set(expandedTools.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedTools.value = next
}

function stateClass(state: string): string {
  if (state === 'COMPLETED' || state === 'SUCCESS') return 'state-ok'
  if (state === 'FAILED' || state === 'CANCELLED') return 'state-fail'
  return 'state-run'
}

function stateText(state: string): string {
  return state === 'COMPLETED' ? '成功' : state === 'FAILED' ? '失败' : state === 'CANCELLED' ? '已取消' : '执行中'
}

function toolStateText(status: string): string {
  return status === 'SUCCESS' ? '成功' : status === 'RUNNING' ? '执行中' : '失败'
}

function shortText(text?: string, len = 80): string {
  if (!text) return ''
  const flat = text.replace(/\n/g, ' ')
  return flat.length > len ? flat.slice(0, len) + '…' : flat
}

function formatTime(t?: string): string {
  if (!t) return '-'
  return t.replace('T', ' ').slice(0, 19)
}

async function loadList(): Promise<void> {
  loading.value = true
  try {
    const res = await planApi.pageExecutions({ page: 1, size: 50 })
    records.value = res.code === 200 ? res.data ?? [] : []
  } catch {
    records.value = []
  } finally {
    loading.value = false
  }
}

async function openDetail(record: ExecutionRecord): Promise<void> {
  selected.value = record
  detailLoading.value = true
  detailError.value = ''
  expandedThinkActs.value = new Set()
  expandedTools.value = new Set()
  try {
    const res = await planApi.executionDetail(record.id)
    if (res.code === 200 && res.data) {
      selected.value = res.data
    } else {
      detailError.value = res.message || '加载执行详情失败'
    }
  } catch {
    detailError.value = '加载执行详情失败'
  } finally {
    detailLoading.value = false
  }
  await loadSnapshots()
}

onMounted(loadList)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">
        <Icon name="activity" :size="24" class="title-icon" />
        执行记录
      </h1>
      <p class="page-desc">查看 Agent 每一步的思考与工具调用过程</p>
    </div>
    <div class="page-content">
      <div v-if="loading" class="empty-hint">
        <Icon name="loader" :size="20" class="spin" />
        加载中...
      </div>
      <div v-else-if="records.length === 0" class="empty-hint">暂无执行记录，先在对话中开启 Agent 或计划模式</div>
      <div v-else class="exec-layout">
        <div class="record-list">
          <button
            v-for="r in records"
            :key="r.id"
            class="record-card"
            :class="{ active: selected?.id === r.id }"
            @click="openDetail(r)"
          >
            <div class="record-top">
              <span class="record-state" :class="stateClass(r.state)">{{ stateText(r.state) }}</span>
              <span class="record-time">{{ formatTime(r.createTime) }}</span>
            </div>
            <div class="record-question">{{ shortText(r.question, 60) || '（无提问内容）' }}</div>
            <div class="record-meta">
              <span>{{ r.agentType || '普通对话' }}</span>
              <span>回合 {{ r.totalRounds ?? 0 }}</span>
              <span>工具 {{ r.toolCallCount ?? 0 }}</span>
              <span>{{ ((r.durationMs ?? 0) / 1000).toFixed(1) }}s</span>
            </div>
          </button>
        </div>

        <div class="record-detail">
          <div v-if="detailLoading" class="detail-empty">
            <Icon name="loader" :size="20" class="spin" />
            加载中...
          </div>
          <div v-else-if="detailError" class="detail-empty">{{ detailError }}</div>
          <div v-else-if="selected" class="detail-scroll">
            <div class="detail-header">
              <div class="detail-question">{{ selected.question || '（无提问内容）' }}</div>
              <div class="detail-meta">
                <span class="record-state" :class="stateClass(selected.state)">{{ stateText(selected.state) }}</span>
                <span>回合 {{ selected.totalRounds ?? 0 }}</span>
                <span>工具调用 {{ selected.toolCallCount ?? 0 }}</span>
                <span>LLM 调用 {{ selected.llmCallCount ?? 0 }}</span>
                <span>Tokens {{ selected.costTokens ?? 0 }}</span>
                <span>耗时 {{ ((selected.durationMs ?? 0) / 1000).toFixed(1) }}s</span>
              </div>
              <div class="detail-actions">
                <button class="action-btn sm" :disabled="snapshotBusy" @click="createSnapshot">
                  <Icon v-if="snapshotBusy" name="loader" :size="12" class="spin" />
                  <Icon name="database" :size="12" />
                  创建快照
                </button>
              </div>
              <div v-if="selected.errorMessage" class="detail-error">{{ selected.errorMessage }}</div>
            </div>

            <div v-if="snapshots.length" class="snapshot-list">
              <div class="snapshot-title">执行快照</div>
              <div v-for="s in snapshots" :key="s.id" class="snapshot-item">
                <span class="snapshot-state">{{ snapshotStateText(s.state) }}</span>
                <span class="snapshot-meta">
                  {{ s.agentName || 'Agent' }} · 第 {{ s.round ?? 0 }} 轮 · {{ formatTime(s.createTime) }}
                </span>
                <button class="action-btn sm danger" @click="deleteSnapshot(s.id)">
                  <Icon name="trash" :size="12" />
                </button>
              </div>
            </div>

            <div v-if="selected.thinkActs.length === 0" class="detail-empty">该执行没有 think-act 明细</div>
            <div v-else class="think-act-list">
              <div v-for="ta in selected.thinkActs" :key="ta.id" class="think-act">
                <button class="think-act-head" @click="toggleThinkAct(ta.id)">
                  <Icon name="chevron-right" :size="13" class="caret" :class="{ rotated: expandedThinkActs.has(ta.id) }" />
                  <Icon name="brain" :size="14" class="think-icon" />
                  <span class="round-badge">第 {{ ta.round }} 轮</span>
                  <span class="think-preview">{{ shortText(ta.thinking, 60) || '无思考内容' }}</span>
                </button>
                <div v-if="expandedThinkActs.has(ta.id)" class="think-act-body">
                  <div v-if="ta.thinking" class="think-text">{{ ta.thinking }}</div>
                  <div v-if="ta.hasToolCall && ta.tools.length" class="tool-list">
                    <div v-for="t in ta.tools" :key="t.id" class="tool-item">
                      <div class="tool-head" @click="toggleTool(t.id)">
                        <span class="tool-status" :class="t.status === 'SUCCESS' ? 'tool-ok' : 'tool-fail'">
                          {{ toolStateText(t.status) }}
                        </span>
                        <span class="tool-name">{{ t.toolName }}</span>
                        <span class="tool-duration">{{ ((t.durationMs ?? 0) / 1000).toFixed(1) }}s</span>
                      </div>
                      <div v-if="expandedTools.has(t.id)" class="tool-detail">
                        <div v-if="t.arguments" class="tool-block">
                          <div class="tool-block-label">参数</div>
                          <pre class="tool-code">{{ t.arguments }}</pre>
                        </div>
                        <div v-if="t.result" class="tool-block">
                          <div class="tool-block-label">结果</div>
                          <pre class="tool-code">{{ shortText(t.result, 2000) }}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="no-tool">本轮无工具调用</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="detail-empty">点击左侧记录查看详情</div>
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
  max-width: 960px;
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
.exec-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.record-list {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}
.record-card {
  text-align: left;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: inherit;
}
.record-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}
.record-card.active {
  border-color: var(--border-accent);
  background: color-mix(in srgb, var(--accent-primary) 6%, transparent);
}
.record-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.record-state {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
}
.state-ok {
  color: var(--accent-success);
  background: color-mix(in srgb, var(--accent-success) 12%, transparent);
}
.state-fail {
  color: var(--accent-error);
  background: color-mix(in srgb, var(--accent-error) 12%, transparent);
}
.state-run {
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
}
.record-time {
  font-size: 11px;
  color: var(--text-quaternary);
}
.record-question {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
}
.record-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-quaternary);
  flex-wrap: wrap;
}
.record-detail {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  min-height: 300px;
  max-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
}
.detail-scroll {
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-quaternary);
  font-size: 13px;
  padding: 40px;
}
.detail-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}
.detail-question {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.5;
}
.detail-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
  flex-wrap: wrap;
  align-items: center;
}
.detail-error {
  font-size: 12px;
  color: var(--accent-error);
  padding: 6px 10px;
  background: color-mix(in srgb, var(--accent-error) 8%, transparent);
  border-radius: 6px;
}
.detail-actions {
  display: flex;
  gap: 8px;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
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
.action-btn.sm {
  padding: 4px 10px;
  font-size: 12px;
}
.action-btn.danger {
  color: var(--accent-error);
}
.snapshot-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
}
.snapshot-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.snapshot-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.snapshot-state {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
  color: var(--accent-primary);
  background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
}
.snapshot-meta {
  flex: 1;
  font-size: 12px;
  color: var(--text-tertiary);
}
.think-act-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.think-act {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  overflow: hidden;
}
.think-act-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.think-act-head:hover {
  background: var(--bg-hover);
}
.caret {
  color: var(--text-tertiary);
  transition: transform 0.2s;
}
.caret.rotated {
  transform: rotate(90deg);
}
.think-icon {
  color: var(--accent-primary);
  flex-shrink: 0;
}
.round-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.think-preview {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-quaternary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.think-act-body {
  padding: 10px 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.think-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
}
.no-tool {
  font-size: 12px;
  color: var(--text-quaternary);
}
.tool-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tool-item {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}
.tool-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
}
.tool-head:hover {
  background: var(--bg-hover);
}
.tool-status {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}
.tool-ok {
  color: var(--accent-success);
  background: color-mix(in srgb, var(--accent-success) 12%, transparent);
}
.tool-fail {
  color: var(--accent-error);
  background: color-mix(in srgb, var(--accent-error) 12%, transparent);
}
.tool-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  font-family: var(--font-code);
}
.tool-duration {
  font-size: 11px;
  color: var(--text-quaternary);
}
.tool-detail {
  padding: 8px 10px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tool-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tool-block-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-quaternary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.tool-code {
  font-family: var(--font-code);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  background: var(--bg-glass);
  border-radius: 6px;
  padding: 8px;
  margin: 0;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
