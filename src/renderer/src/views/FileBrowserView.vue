<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fileApi, type FileNode, type PlanFile } from '@renderer/api/files'
import Icon from '@renderer/components/common/Icon.vue'

const rootNodes = ref<FileNode[]>([])
const loading = ref(false)
const errorMsg = ref('')
const currentPath = ref('')

/** 展开/收起节点 */
const expanded = ref<Set<string>>(new Set())
function toggleDir(node: FileNode): void {
  if (!node.isDir) return
  if (expanded.value.has(node.path)) {
    expanded.value.delete(node.path)
  } else {
    expanded.value.add(node.path)
  }
}

async function expandDir(node: FileNode): Promise<void> {
  toggleDir(node)
  if (expanded.value.has(node.path) && !node.children?.length) {
    try {
      const res = await fileApi.browse(node.path, 0)
      if (res.code === 200) node.children = res.data ?? []
    } catch {
      // 已提示
    }
  }
}

/** 文件内容预览 */
const contentVisible = ref(false)
const contentLoading = ref(false)
const contentPath = ref('')
const contentText = ref('')
const contentSize = ref(0)

async function openFile(node: FileNode): Promise<void> {
  if (node.isDir) return
  contentVisible.value = true
  contentLoading.value = true
  contentPath.value = node.path
  contentText.value = ''
  try {
    const res = await fileApi.read(node.path)
    if (res.code === 200) {
      contentText.value = res.data?.content ?? ''
      contentSize.value = res.data?.size ?? 0
    }
  } catch {
    contentText.value = '读取失败'
  } finally {
    contentLoading.value = false
  }
}

/** 计划触达文件 */
const planFiles = ref<PlanFile[]>([])
const planFilesVisible = ref(false)
const planIdInput = ref('')
const planLoading = ref(false)

async function loadPlanFiles(): Promise<void> {
  if (!planIdInput.value.trim()) return
  planFilesVisible.value = true
  planLoading.value = true
  planFiles.value = []
  try {
    const res = await fileApi.planFiles(planIdInput.value.trim())
    planFiles.value = res.code === 200 ? res.data ?? [] : []
  } catch {
    planFiles.value = []
  } finally {
    planLoading.value = false
  }
}

async function browseRoot(path?: string): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fileApi.browse(path, 0)
    if (res.code === 200) {
      rootNodes.value = res.data ?? []
      currentPath.value = path ?? ''
    } else {
      errorMsg.value = res.message || '浏览失败'
    }
  } catch {
    errorMsg.value = '浏览失败'
  } finally {
    loading.value = false
  }
}

function formatSize(size?: number): string {
  if (size == null) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function opText(op: string): string {
  switch (op) {
    case 'write_file':
      return '写入'
    case 'edit_file':
      return '编辑'
    case 'delete_file':
      return '删除'
    case 'grep_file':
      return '搜索'
    case 'read_file':
      return '读取'
    case 'list_files':
      return '列出'
    case 'glob_files':
      return '匹配'
    default:
      return op
  }
}

onMounted(() => browseRoot())
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">
        <Icon name="folder" :size="24" class="title-icon" />
        文件浏览器
      </h1>
      <p class="page-desc">浏览 Agent 工作区文件，查看计划执行过程中触达过的文件</p>
    </div>

    <div class="page-content">
      <div class="toolbar">
        <button class="action-btn" @click="browseRoot(currentPath)">
          <Icon name="refresh" :size="14" />
          刷新
        </button>
        <span class="current-path">{{ currentPath || '（工作区根目录）' }}</span>
      </div>

      <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>
      <div v-if="loading" class="empty-hint">
        <Icon name="loader" :size="18" class="spin" />
        加载中...
      </div>
      <div v-else-if="rootNodes.length === 0" class="empty-hint">（空目录）</div>
      <div v-else class="file-tree">
        <div v-for="node in rootNodes" :key="node.path" class="tree-node" :style="{ paddingLeft: '0px' }">
          <div class="tree-row" @click="node.isDir ? expandDir(node) : openFile(node)">
            <Icon
              :name="node.isDir ? (expanded.has(node.path) ? 'folder' : 'folder') : 'file'"
              :size="14"
              class="node-icon"
              :class="{ dir: node.isDir }"
            />
            <span class="node-name">{{ node.name }}</span>
            <span v-if="!node.isDir" class="node-size">{{ formatSize(node.size) }}</span>
            <Icon v-if="node.isDir && expanded.has(node.path)" name="chevron-down" :size="12" class="node-caret" />
            <Icon v-else-if="node.isDir" name="chevron-right" :size="12" class="node-caret" />
          </div>
          <div v-if="node.isDir && expanded.has(node.path)" class="tree-children">
            <div
              v-for="child in node.children"
              :key="child.path"
              class="tree-node"
              :style="{ paddingLeft: '18px' }"
            >
              <div class="tree-row" @click="child.isDir ? expandDir(child) : openFile(child)">
                <Icon name="folder" :size="13" class="node-icon dir" />
                <span class="node-name">{{ child.name }}</span>
                <span v-if="!child.isDir" class="node-size">{{ formatSize(child.size) }}</span>
                <Icon
                  v-if="child.isDir"
                  :name="expanded.has(child.path) ? 'chevron-down' : 'chevron-right'"
                  :size="12"
                  class="node-caret"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="plan-section">
        <div class="plan-head">
          <span class="plan-label">
            <Icon name="git-branch" :size="12" />
            计划触达文件
          </span>
          <div class="plan-input">
            <input v-model="planIdInput" placeholder="输入计划 ID" />
            <button class="action-btn sm" :disabled="!planIdInput.trim()" @click="loadPlanFiles">查询</button>
          </div>
        </div>
        <div v-if="planFilesVisible" class="plan-files">
          <div v-if="planLoading" class="empty-hint">
            <Icon name="loader" :size="16" class="spin" />
            加载中...
          </div>
          <div v-else-if="planFiles.length === 0" class="empty-hint">该计划没有触达任何文件</div>
          <div v-else class="plan-file-list">
            <div v-for="pf in planFiles" :key="pf.path" class="plan-file-item">
              <Icon name="file" :size="13" class="node-icon" />
              <span class="plan-file-path">{{ pf.path }}</span>
              <span class="plan-file-op">{{ opText(pf.operation) }}</span>
              <span class="plan-file-exists" :class="pf.exists ? 'ok' : 'gone'">
                {{ pf.exists ? '存在' : '已删除' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 文件内容预览 -->
    <div v-if="contentVisible" class="modal-mask" @click.self="contentVisible = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ contentPath }}</h3>
          <button class="icon-btn" @click="contentVisible = false">
            <Icon name="x" :size="16" />
          </button>
        </div>
        <div class="modal-body">
          <div v-if="contentLoading" class="empty-hint">
            <Icon name="loader" :size="16" class="spin" />
            加载中...
          </div>
          <pre v-else class="file-content">{{ contentText }}</pre>
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
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 13px;
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
  padding: 5px 10px;
  font-size: 12px;
}
.current-path {
  font-size: 12px;
  color: var(--text-quaternary);
  font-family: var(--font-code);
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
  padding: 24px 0;
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
.file-tree {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tree-node {
  display: flex;
  flex-direction: column;
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.tree-row:hover {
  background: var(--bg-hover);
}
.node-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.node-icon.dir {
  color: var(--accent-primary);
}
.node-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-size {
  font-size: 11px;
  color: var(--text-quaternary);
}
.node-caret {
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.tree-children {
  display: flex;
  flex-direction: column;
}
.plan-section {
  margin-top: 28px;
}
.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.plan-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
}
.plan-input {
  display: flex;
  gap: 8px;
}
.plan-input input {
  width: 160px;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}
.plan-files {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  padding: 8px;
}
.plan-file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.plan-file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
}
.plan-file-item:hover {
  background: var(--bg-hover);
}
.plan-file-path {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-code);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plan-file-op {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  color: var(--accent-primary);
  flex-shrink: 0;
}
.plan-file-exists {
  font-size: 11px;
  flex-shrink: 0;
}
.plan-file-exists.ok {
  color: var(--accent-success);
}
.plan-file-exists.gone {
  color: var(--accent-error);
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
  width: 640px;
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
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}
.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.modal-body {
  padding: 16px 18px;
  overflow-y: auto;
}
.file-content {
  font-family: var(--font-code);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 60vh;
  overflow-y: auto;
}
</style>
