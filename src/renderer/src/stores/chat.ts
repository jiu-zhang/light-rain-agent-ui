/**
 * 聊天状态管理
 * <p>
 * 管理当前对话状态、消息列表、SSE 流式响应等。
 * </p>
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { chatApi } from '@renderer/api/chat'
import { closeOpenCodeBlock } from '@renderer/utils'
import type {
  ChatEvent,
  ChatEventType,
  ChatMessage,
  InputRequestPayload,
  PlanStepPayload,
  Session
} from '@renderer/types'

/** 计划步骤展示项 */
export interface PlanStepDisplay {
  index: number
  name: string
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  error?: string
}

/** 工具运行展示项 */
export interface ToolRun {
  id: string
  toolName: string
  arguments?: string
  result?: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED'
  durationMs?: number
}

/** 发送选项 */
export interface SendOptions {
  agentMode?: boolean
  plan?: boolean
  templateId?: string
  steps?: import('@renderer/types').PlanStep[]
}

export const useChatStore = defineStore('chat', () => {
  /** 当前会话 ID */
  const currentSessionId = ref<string | null>(null)

  /** 会话列表 */
  const sessions = ref<Session[]>([])

  /** 当前会话的消息列表 */
  const messages = ref<ChatEvent[]>([])

  /** 是否正在加载 */
  const loading = ref(false)

  /** 当前 AbortController，用于中断请求 */
  let abortController: AbortController | null = null

  /** 消息 uid 自增计数器 */
  let uidSeq = 0

  // ─── 执行面板状态 ───────────────────────────────
  /** 当前计划步骤列表 */
  const planSteps = ref<PlanStepDisplay[]>([])
  /** 当前工具运行列表 */
  const toolRuns = ref<ToolRun[]>([])
  /** 是否正在执行计划（至少收到 PLAN_START） */
  const isPlanRunning = ref(false)
  /** 计划目标 */
  const planGoal = ref('')
  /** 工具运行 id 自增 */
  let toolSeq = 0

  /** 待用户输入的请求（收到 INPUT_REQUEST 后由组件弹窗收集） */
  const pendingInput = ref<InputRequestPayload | null>(null)

  /** 创建带稳定 uid 的聊天事件 */
  function makeEvent(type: ChatEventType, content?: string, role?: ChatEvent['role']): ChatEvent {
    return { uid: `msg-${++uidSeq}`, type, content, role }
  }

  /** 中断当前流式请求（切换会话/新建会话/停止时共用） */
  function abortCurrentStream(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    loading.value = false
    pendingInput.value = null
  }

  /** 重置执行面板状态 */
  function resetExecution(): void {
    planSteps.value = []
    toolRuns.value = []
    isPlanRunning.value = false
    planGoal.value = ''
  }

  /** 处理 PLAN_START 事件 */
  function handlePlanStart(content: string): void {
    try {
      const payload = JSON.parse(content)
      planSteps.value = (payload.steps || []).map((s: { name: string }, i: number) => ({
        index: i + 1,
        name: s.name,
        status: 'RUNNING'
      }))
      planGoal.value = payload.goal || ''
      isPlanRunning.value = true
    } catch {
      // 解析失败忽略
    }
  }

  /** 处理 PLAN_STEP 事件 */
  function handlePlanStep(content: string): void {
    try {
      const payload: PlanStepPayload = JSON.parse(content)
      const idx = planSteps.value.findIndex((s) => s.index === payload.index)
      if (idx >= 0) {
        planSteps.value[idx].status = payload.status
        planSteps.value[idx].error = payload.error
      } else {
        planSteps.value.push({
          index: payload.index,
          name: payload.name,
          status: payload.status,
          error: payload.error
        })
      }
    } catch {
      // 解析失败忽略
    }
  }

  /** 处理 PLAN_DONE 事件 */
  function handlePlanDone(): void {
    for (const s of planSteps.value) {
      if (s.status === 'RUNNING') s.status = 'COMPLETED'
    }
  }

  /** 处理 TOOL_CALL 事件 */
  function handleToolCall(content: string): void {
    try {
      const tc = JSON.parse(content)
      const id = tc.id || `tool-${++toolSeq}`
      toolRuns.value.push({
        id,
        toolName: tc.name || 'unknown',
        arguments: tc.arguments,
        status: 'RUNNING'
      })
    } catch {
      toolRuns.value.push({
        id: `tool-${++toolSeq}`,
        toolName: 'unknown',
        arguments: content,
        status: 'RUNNING'
      })
    }
  }

  /** 处理 TOOL_CONTENT 事件 */
  function handleToolContent(content: string): void {
    try {
      const tr = JSON.parse(content)
      const run = toolRuns.value.find((t) => t.id === tr.id)
      if (run) {
        run.result = typeof tr.responseData === 'string' ? tr.responseData : content
        run.status = 'SUCCESS'
      } else {
        toolRuns.value.push({
          id: `tool-${++toolSeq}`,
          toolName: 'unknown',
          result: content,
          status: 'SUCCESS'
        })
      }
    } catch {
      // 解析失败忽略
    }
  }

  /** 加载会话列表 */
  async function loadSessions(): Promise<void> {
    try {
      const res = await chatApi.listSessions()
      if (res.code === 200 && res.data?.length) {
        sessions.value = res.data
      }
    } catch (e) {
      console.warn('加载会话列表失败:', e)
    }
  }

  /** 切换当前会话 */
  async function switchSession(sessionId: string): Promise<void> {
    abortCurrentStream()
    currentSessionId.value = sessionId
    messages.value = []
    resetExecution()
    await loadMessages(sessionId)
  }

  /** 加载会话历史消息 */
  async function loadMessages(sessionId: string): Promise<void> {
    try {
      const res = await chatApi.getMessages({ sessionId, page: 1, size: 100 })
      if (res.code === 200 && res.data?.list) {
        messages.value = restoreHistory(res.data.list)
      }
    } catch (e) {
      console.warn('加载消息历史失败:', e)
    }
  }

  /**
   * 将后端历史消息还原为聊天事件流
   * <p>
   * 后端消息按 role 存储，assistant 消息的 metadata 中含 toolCalls/reasoningContent，
   * tool 消息的 metadata 中含 toolResponses，据此还原完整的 REASONING/TOOL_CALL/TOOL_CONTENT。
   * </p>
   */
  function restoreHistory(list: ChatMessage[]): ChatEvent[] {
    const events: ChatEvent[] = []
    for (const msg of list) {
      const meta = parseMetadata(msg.metadata)
      if (msg.role === 'user') {
        events.push(makeEvent('CONTENT', msg.content, 'user'))
      } else if (msg.role === 'assistant') {
        const toolCalls = meta?.toolCalls
        if (Array.isArray(toolCalls) && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            events.push(makeEvent('TOOL_CALL', JSON.stringify(tc)))
          }
        }
        if (typeof meta?.reasoningContent === 'string' && meta.reasoningContent) {
          events.push(makeEvent('REASONING', meta.reasoningContent))
        }
        if (msg.content) {
          events.push(makeEvent('CONTENT', msg.content, 'assistant'))
        }
      } else if (msg.role === 'tool') {
        const responses = Array.isArray(meta?.toolResponses)
          ? meta.toolResponses
          : tryParseJsonArray(msg.content)
        for (const r of responses) {
          events.push(makeEvent('TOOL_CONTENT', JSON.stringify(r)))
        }
      }
    }
    return events
  }

  /** 解析 metadata JSON，失败返回 null */
  function parseMetadata(metadata?: string): Record<string, unknown> | null {
    if (!metadata) return null
    try {
      const parsed = JSON.parse(metadata)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }

  /** 尝试把字符串解析为数组，失败返回空数组 */
  function tryParseJsonArray(text?: string): unknown[] {
    if (!text) return []
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  /** 上次发送使用的模型 ID，重新生成时沿用 */
  let lastModelId: string | undefined

  /** 上次发送使用的执行选项（重新生成时沿用） */
  let lastSendOptions: SendOptions = {}

  /**
   * 发送消息（使用 fetch POST + ReadableStream SSE）
   */
  function sendMessage(question: string, modelId?: string, options: SendOptions = {}): void {
    if (!currentSessionId.value) return
    lastModelId = modelId
    lastSendOptions = options
    resetExecution()
    messages.value.push(makeEvent('CONTENT', question, 'user'))
    streamFrom(question, modelId, options)
  }

  /** 核心流式请求逻辑（不新增用户消息） */
  function streamFrom(
    question: string,
    modelId?: string,
    options: SendOptions = {}
  ): void {
    if (!currentSessionId.value) return
    loading.value = true

    let contentBuffer = ''
    const requestPayload: import('@renderer/types').ChatRequest = {
      sessionId: currentSessionId.value,
      question,
      modelId,
      agentMode: options.agentMode,
      plan: options.plan,
      templateId: options.templateId,
      steps: options.steps
    }

    abortController = chatApi.chat(
      requestPayload,
      {
        onContent(text) {
          contentBuffer += text
          updateLastMessage('CONTENT', contentBuffer)
        },
        onReasoning(text) {
          messages.value.push(makeEvent('REASONING', text))
        },
        onToolCall(text) {
          // content 流被工具打断：补全当前消息中可能未闭合的代码块，重置缓冲区
          const last = messages.value[messages.value.length - 1]
          if (last && last.type === 'CONTENT' && last.role !== 'user') {
            last.content = closeOpenCodeBlock(last.content || '')
          }
          contentBuffer = ''
          messages.value.push(makeEvent('TOOL_CALL', text))
          handleToolCall(text)
        },
        onToolContent(text) {
          messages.value.push(makeEvent('TOOL_CONTENT', text))
          handleToolContent(text)
        },
        onStatus(text) {
          messages.value.push(makeEvent('STATUS', text))
        },
        onPlanStart(content) {
          messages.value.push(makeEvent('PLAN_START', content))
          handlePlanStart(content)
        },
        onPlanStep(content) {
          messages.value.push(makeEvent('PLAN_STEP', content))
          handlePlanStep(content)
        },
        onPlanDone(content) {
          messages.value.push(makeEvent('PLAN_DONE', content))
          handlePlanDone()
        },
        onInputRequest(payload) {
          messages.value.push(makeEvent('INPUT_REQUEST', JSON.stringify(payload)))
          pendingInput.value = payload
        },
        onDone() {
          loading.value = false
          abortController = null
          pendingInput.value = null
          notifyTaskDone(Boolean(options.plan) || Boolean(options.agentMode))
        },
        onError(error) {
          const evt = makeEvent('ERROR')
          evt.error = error
          messages.value.push(evt)
          loading.value = false
          abortController = null
          pendingInput.value = null
        }
      }
    )
  }

  /** 任务完成时如果窗口不可见，弹出桌面通知 */
  function notifyTaskDone(agentMode: boolean): void {
    if (!document.hidden || typeof Notification === 'undefined') return
    try {
      new Notification('LightRain', { body: agentMode ? 'Agent 任务已完成' : 'AI 回复已完成' })
    } catch {
      // 通知不可用时静默忽略
    }
  }

  /** 重新生成最后一条 AI 回复 */
  async function regenerate(): Promise<void> {
    if (!currentSessionId.value || loading.value) return
    // 找到最后一条用户消息，移除其后的 AI 回合
    let lastUserIdx = -1
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'user') {
        lastUserIdx = i
        break
      }
    }
    if (lastUserIdx < 0) return
    const question = messages.value[lastUserIdx].content ?? ''
    messages.value = messages.value.slice(0, lastUserIdx + 1)
    // 删除后端最后一条 assistant 回复，避免 LLM 参考旧答案
    try {
      await chatApi.deleteLastAssistant(currentSessionId.value)
    } catch {
      // 删除失败不阻塞重新生成
    }
    resetExecution()
    streamFrom(question, lastModelId, lastSendOptions)
  }

  /** 更新最后一条 CONTENT 消息或追加新消息 */
  function updateLastMessage(type: string, content: string): void {
    const last = messages.value[messages.value.length - 1]
    if (last && last.type === type && last.role !== 'user') {
      last.content = content
    } else {
      messages.value.push(makeEvent(type as ChatEventType, content, 'assistant'))
    }
  }

  /** 中断当前响应 */
  async function interrupt(): Promise<void> {
    abortCurrentStream()
    if (currentSessionId.value) {
      try {
        await chatApi.interrupt(currentSessionId.value)
      } catch {
        // 中断请求失败不阻塞本地状态复位
      }
    }
  }

  /** 提交用户交互输入 */
  async function submitPendingInput(value: string): Promise<void> {
    const req = pendingInput.value
    if (!req || !currentSessionId.value) return
    try {
      await chatApi.submitInput(currentSessionId.value, req.requestId, value)
      pendingInput.value = null
    } catch {
      // 已由拦截器统一提示
    }
  }

  /** 创建新会话 */
  async function createSession(): Promise<void> {
    abortCurrentStream()
    let newId: string
    try {
      const res = await chatApi.generateId()
      newId = String(res.data)
    } catch {
      newId = String(Date.now())
    }
    const now = new Date().toISOString()
    sessions.value.unshift({
      id: newId,
      title: '新对话',
      createTime: now,
      updateTime: now
    })
    currentSessionId.value = newId
    messages.value = []
    resetExecution()
  }

  return {
    currentSessionId,
    sessions,
    messages,
    loading,
    planSteps,
    toolRuns,
    isPlanRunning,
    planGoal,
    pendingInput,
    resetExecution,
    loadSessions,
    switchSession,
    loadMessages,
    sendMessage,
    regenerate,
    interrupt,
    submitPendingInput,
    createSession
  }
})
