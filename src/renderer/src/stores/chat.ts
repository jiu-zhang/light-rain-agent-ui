/**
 * 聊天状态管理
 * <p>
 * 管理当前对话状态、消息列表、SSE 流式响应等。
 * </p>
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { chatApi } from '@renderer/api/chat'
import { closeOpenCodeBlock } from '@renderer/utils'
import type {
  Attachment,
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
  /** 多模态附件（图片等），随消息发送给模型 */
  attachments?: Attachment[]
  /** 是否开启深度思考（模型先思考再回答） */
  deepThink?: boolean
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

  /** 每页消息条数 */
  const MESSAGE_PAGE_SIZE = 50

  /** 消息总页数（后端返回） */
  const messagePages = ref(0)

  /** 列表中最新一页对应的页码（1 为最早一页） */
  const messageLoadedPage = ref(0)

  /** 是否正在加载更早的消息 */
  const loadingOlder = ref(false)

  /** 是否还有更早的消息可加载 */
  const hasMoreMessages = computed(() => messageLoadedPage.value > 1)

  /** 当前 AbortController，用于中断请求 */
  let abortController: AbortController | null = null

  /** 流代次 token：新开流/切换会话时递增，使过期流的回调失效，避免竞态写入 */
  let streamGeneration = 0

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
  function makeEvent(
    type: ChatEventType,
    content?: string,
    role?: ChatEvent['role'],
    attachments?: Attachment[]
  ): ChatEvent {
    return { uid: `msg-${++uidSeq}`, type, content, role, attachments }
  }

  /** 中断当前流式请求（切换会话/新建会话/停止时共用） */
  function abortCurrentStream(): void {
    // 使所有在途回调失效（过期流的 onDone/onContent 不再写入新状态）
    streamGeneration++
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

  /** 加载会话列表（只取最新一页，避免一次加载全部） */
  async function loadSessions(): Promise<void> {
    try {
      const res = await chatApi.listSessionsPage(1, 50)
      if (res.code === 200 && res.data?.list) {
        sessions.value = res.data.list
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
    messageLoadedPage.value = 0
    messagePages.value = 0
    resetExecution()
    await loadLatestMessages(sessionId)
  }

  /** 加载会话历史消息（只取最新一页，划到顶部再向上翻页） */
  async function loadLatestMessages(sessionId: string): Promise<void> {
    try {
      const res = await chatApi.getMessages({ sessionId, pageNum: 1, pageSize: MESSAGE_PAGE_SIZE })
      if (res.code === 200 && res.data) {
        messagePages.value = Number(res.data.pages) || 0
        let list = res.data.list ?? []
        let page = messagePages.value || 1
        if (page > 1) {
          const last = await chatApi.getMessages({
            sessionId,
            pageNum: page,
            pageSize: MESSAGE_PAGE_SIZE
          })
          if (last.code === 200 && last.data?.list) {
            list = last.data.list
          } else {
            page = 1
          }
        }
        messageLoadedPage.value = page
        messages.value = restoreHistory(list)
      }
    } catch (e) {
      console.warn('加载消息历史失败:', e)
    }
  }

  /** 向上加载更早一页的历史消息（划到顶部时触发） */
  async function loadOlderMessages(): Promise<void> {
    if (loadingOlder.value || !currentSessionId.value || messageLoadedPage.value <= 1) return
    loadingOlder.value = true
    try {
      const prev = messageLoadedPage.value - 1
      const res = await chatApi.getMessages({
        sessionId: currentSessionId.value,
        pageNum: prev,
        pageSize: MESSAGE_PAGE_SIZE
      })
      if (res.code === 200 && res.data?.list?.length) {
        const older = restoreHistory(res.data.list)
        messages.value = [...older, ...messages.value]
        messageLoadedPage.value = prev
      } else {
        messageLoadedPage.value = 1
      }
    } catch (e) {
      console.warn('加载更早消息失败:', e)
    } finally {
      loadingOlder.value = false
    }
  }

  /**
   * 将后端历史消息还原为聊天事件流
   * <p>
   * 优先使用 events 列（回合完整事件流，按原始顺序还原思考/工具/计划/正文）；
   * 仅当会话中没有 events 记录时才走 metadata 的旧版还原逻辑（兼容历史数据）。
   * </p>
   */
  function restoreHistory(list: ChatMessage[]): ChatEvent[] {
    // 第一个权威回合记录（assistant 且带 events 列）
    const firstEventsIdx = list.findIndex((m) => m.role === 'assistant' && m.events)
    if (firstEventsIdx < 0) {
      return mergeAdjacent(restoreLegacyHistory(list))
    }

    // 向前回溯到该回合的提问行：普通模式 advisor 会额外写一条内容相同的 user 行，
    // 从该行起都属于事件回合的覆盖范围，其之前才是旧数据（兼容刷新前产生的历史）
    const firstQuestion = parseEventsEnvelope(list[firstEventsIdx].events)?.question
    let legacyEnd = firstEventsIdx
    if (firstQuestion) {
      for (let i = firstEventsIdx - 1; i >= 0; i--) {
        if (list[i].role === 'user') {
          if (list[i].content === firstQuestion) {
            legacyEnd = i
          }
          break
        }
      }
    }

    const events: ChatEvent[] = []
    events.push(...restoreLegacyHistory(list.slice(0, legacyEnd)))
    for (const msg of list) {
      if (msg.role !== 'assistant' || !msg.events) continue
      const envelope = parseEventsEnvelope(msg.events)
      if (!envelope) {
        // events 列解析失败（异常数据）：回退按旧逻辑还原单条，避免丢回答
        events.push(...restoreLegacyHistory([msg]))
        continue
      }
      if (envelope.question) {
        events.push(makeEvent('CONTENT', envelope.question, 'user', envelope.attachments))
      }
      for (const item of envelope.events) {
        const evt = makeEvent(item.type as ChatEventType, item.content, item.role)
        if (item.error) evt.error = item.error
        events.push(evt)
      }
    }
    return mergeAdjacent(events)
  }

  /**
   * 合并相邻的 CONTENT/REASONING 增量分片
   * <p>
   * 实时流按 token 增量推送，若不经合并直接还原会把一段回答拆成大量碎片气泡；
   * 用户消息（role=user）永不合并，避免吞并相邻提问。
   * </p>
   */
  function mergeAdjacent(list: ChatEvent[]): ChatEvent[] {
    const merged: ChatEvent[] = []
    for (const evt of list) {
      const last = merged[merged.length - 1]
      const mergeable =
        last &&
        last.type === evt.type &&
        (last.type === 'CONTENT' || last.type === 'REASONING') &&
        last.role !== 'user' &&
        evt.role !== 'user'
      if (mergeable) {
        last.content = (last.content ?? '') + (evt.content ?? '')
      } else {
        merged.push({ ...evt })
      }
    }
    return merged
  }

  /**
   * 旧版还原：按 role 逐条还原 user/assistant/tool 消息
   * <p>
   * assistant 消息从 metadata 还原 toolCalls/reasoningContent，tool 消息还原 toolResponses。
   * </p>
   */
  function restoreLegacyHistory(list: ChatMessage[]): ChatEvent[] {
    const events: ChatEvent[] = []
    for (const msg of list) {
      const meta = parseMetadata(msg.metadata)
      if (msg.role === 'user') {
        const attachments = extractAttachments(meta)
        const evt = makeEvent('CONTENT', msg.content, 'user', attachments)
        events.push(evt)
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
    return mergeAdjacent(events)
  }

  /**
   * 解析 events 列 JSON 信封（question + events 数组 + 可选 attachments），失败返回 null
   */
  function parseEventsEnvelope(events?: string): {
    question?: string
    attachments?: Attachment[]
    events: Array<{
      type: string
      content?: string
      role?: 'user' | 'assistant' | 'tool'
      error?: string
    }>
  } | null {
    if (!events) return null
    try {
      const parsed = JSON.parse(events)
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.events)) return null
      return {
        question: typeof parsed.question === 'string' ? parsed.question : undefined,
        attachments: extractAttachments(parsed),
        events: parsed.events as Array<{
          type: string
          content?: string
          role?: 'user' | 'assistant' | 'tool'
          error?: string
        }>
      }
    } catch {
      return null
    }
  }

  /** 从 metadata 中解析附件描述列表 */
  function extractAttachments(meta: Record<string, unknown> | null): Attachment[] | undefined {
    const raw = meta?.attachments
    if (!Array.isArray(raw) || raw.length === 0) return undefined
    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        fileId: String(item.fileId ?? ''),
        name: String(item.name ?? '附件'),
        mimeType: item.mimeType !== undefined ? String(item.mimeType) : undefined,
        size: item.size !== undefined ? Number(item.size) : undefined,
        localPath: item.localPath !== undefined ? String(item.localPath) : undefined
      }))
      .filter((a) => a.fileId || a.localPath)
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
    // 中止在途流，避免并发请求互相覆盖状态（快捷指令/快速连点场景）
    abortCurrentStream()
    resetExecution()
    messages.value.push(makeEvent('CONTENT', question, 'user', options.attachments))
    streamFrom(question, modelId, options)
  }

  /** 核心流式请求逻辑（不新增用户消息） */
  function streamFrom(question: string, modelId?: string, options: SendOptions = {}): void {
    if (!currentSessionId.value) return
    loading.value = true
    const gen = ++streamGeneration

    let contentBuffer = ''
    let reasoningBuffer = ''
    const requestPayload: import('@renderer/types').ChatRequest = {
      sessionId: currentSessionId.value,
      question,
      modelId,
      agentMode: options.agentMode,
      plan: options.plan,
      templateId: options.templateId,
      steps: options.steps,
      attachments: options.attachments,
      deepThink: options.deepThink
    }

    abortController = chatApi.chat(requestPayload, {
      onContent(text) {
        if (gen !== streamGeneration) return
        contentBuffer += text
        updateLastMessage('CONTENT', contentBuffer)
      },
      onReasoning(text) {
        if (gen !== streamGeneration) return
        const last = messages.value[messages.value.length - 1]
        if (last && last.type === 'REASONING') {
          // 同一推理阶段内持续累积：后端逐 chunk 推送推理增量
          // 若推送的是累积内容则直接替换，避免重复拼接
          if (reasoningBuffer && text.startsWith(reasoningBuffer)) {
            reasoningBuffer = text
          } else {
            reasoningBuffer += text
          }
          last.content = reasoningBuffer
        } else {
          // 新的推理阶段（如 Agent 多轮思考），重置缓冲并新建气泡
          reasoningBuffer = text
          messages.value.push(makeEvent('REASONING', reasoningBuffer))
        }
      },
      onToolCall(text) {
        if (gen !== streamGeneration) return
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
        if (gen !== streamGeneration) return
        messages.value.push(makeEvent('TOOL_CONTENT', text))
        handleToolContent(text)
      },
      onStatus(text) {
        if (gen !== streamGeneration) return
        messages.value.push(makeEvent('STATUS', text))
      },
      onNotice(text) {
        if (gen !== streamGeneration) return
        messages.value.push(makeEvent('NOTICE', text))
      },
      onPlanStart(content) {
        if (gen !== streamGeneration) return
        messages.value.push(makeEvent('PLAN_START', content))
        handlePlanStart(content)
      },
      onPlanStep(content) {
        if (gen !== streamGeneration) return
        messages.value.push(makeEvent('PLAN_STEP', content))
        handlePlanStep(content)
      },
      onPlanDone(content) {
        if (gen !== streamGeneration) return
        messages.value.push(makeEvent('PLAN_DONE', content))
        handlePlanDone()
      },
      onInputRequest(payload) {
        if (gen !== streamGeneration) return
        messages.value.push(makeEvent('INPUT_REQUEST', JSON.stringify(payload)))
        pendingInput.value = payload
      },
      onDone() {
        if (gen !== streamGeneration) return
        loading.value = false
        abortController = null
        pendingInput.value = null
        notifyTaskDone(Boolean(options.plan) || Boolean(options.agentMode))
      },
      onError(error) {
        if (gen !== streamGeneration) return
        const evt = makeEvent('ERROR')
        evt.error = error
        messages.value.push(evt)
        loading.value = false
        abortController = null
        pendingInput.value = null
      }
    })
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
    const attachments = messages.value[lastUserIdx].attachments
    messages.value = messages.value.slice(0, lastUserIdx + 1)
    // 删除后端最后一条 assistant 回复，避免 LLM 参考旧答案
    try {
      await chatApi.deleteLastAssistant(currentSessionId.value)
    } catch {
      // 删除失败不阻塞重新生成
    }
    resetExecution()
    streamFrom(question, lastModelId, { ...lastSendOptions, attachments })
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
    if (!currentSessionId.value) return
    // 先通知后端标记中断，再断开 SSE；后端可能仍在长耗时的 LLM 调用中，
    // 本地主动补一条中断状态提示，避免界面无响应
    try {
      await chatApi.interrupt(currentSessionId.value)
    } catch {
      // 中断请求失败不阻塞本地状态复位
    }
    if (loading.value) {
      messages.value.push(makeEvent('STATUS', '任务已被用户中断'))
    }
    abortCurrentStream()
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
    messageLoadedPage.value = 1
    messagePages.value = 1
    resetExecution()
  }

  return {
    currentSessionId,
    sessions,
    messages,
    loading,
    loadingOlder,
    hasMoreMessages,
    planSteps,
    toolRuns,
    isPlanRunning,
    planGoal,
    pendingInput,
    resetExecution,
    loadSessions,
    switchSession,
    loadLatestMessages,
    loadOlderMessages,
    sendMessage,
    regenerate,
    interrupt,
    submitPendingInput,
    createSession,
    restoreHistory
  }
})
