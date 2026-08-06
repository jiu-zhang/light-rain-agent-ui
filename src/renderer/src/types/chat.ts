/**
 * 聊天相关类型定义
 */

/** 聊天事件类型 */
export type ChatEventType =
  | 'CONTENT'
  | 'REASONING'
  | 'TOOL_CALL'
  | 'TOOL_CONTENT'
  | 'STATUS'
  | 'NOTICE'
  | 'PLAN_START'
  | 'PLAN_STEP'
  | 'PLAN_DONE'
  | 'TOOL_DETAIL'
  | 'INPUT_REQUEST'
  | 'INPUT_SUBMIT'
  | 'DONE'
  | 'ERROR'

/** 聊天事件 */
export interface ChatEvent {
  /** 前端渲染用的稳定唯一 ID（流式追加时避免索引 key 错位） */
  uid: string
  type: ChatEventType
  content?: string
  error?: string
  role?: 'user' | 'assistant' | 'tool'
  /** 用户消息附带的多模态附件（图片等） */
  attachments?: Attachment[]
}

/**
 * 一轮对话（用户提问，或一次完整的 AI 回复）
 * <p>
 * 一次 AI 回复中的思考 / 工具调用 / 正文等事件被归并为一个回合，
 * 在界面上统一展示在同一个气泡内，避免流式输出被拆成多个气泡。
 * </p>
 */
export interface ChatTurn {
  /** 定位用 uid：用户消息取自身 uid，AI 回复取首个子事件 uid */
  uid: string
  role: 'user' | 'assistant'
  /** 用户提问文本（仅 user 回合） */
  content?: string
  /** 用户消息附带的多模态附件（仅 user 回合） */
  attachments?: Attachment[]
  /** 子事件列表（按到达顺序），AI 回合的思考/工具/正文/状态都归入其中 */
  events: ChatEvent[]
  /** 最终错误信息（AI 回合遇到错误时） */
  error?: string
  /** 是否为当前正在流式输出的 AI 回合 */
  streaming?: boolean
}

/** 附件描述（上传后由后端返回 fileId，或直接引用本地路径） */
export interface Attachment {
  /** 附件唯一标识（落盘文件名） */
  fileId: string
  /** 原始文件名 */
  name: string
  /** MIME 类型，如 image/png */
  mimeType?: string
  /** 文件大小（字节） */
  size?: number
  /** 本地预览 URL（仅当前会话内有效，用于上传后即时预览） */
  previewUrl?: string
  /** 本地文件绝对路径（Electron 端直接引用原文件，不落盘副本） */
  localPath?: string
}

/** 聊天请求 */
export interface ChatRequest {
  sessionId: string
  question: string
  modelId?: string
  agentMode?: boolean
  /** 计划模式：LLM 自动拆分多步骤并执行 */
  plan?: boolean
  /** 计划模板 ID：使用模板预定义步骤 */
  templateId?: string
  /** 计划步骤：直接按指定步骤执行 */
  steps?: PlanStep[]
  /** 附件列表（多模态图片等） */
  attachments?: Attachment[]
}

/** 计划步骤 */
export interface PlanStep {
  name: string
  description: string
}

/** 计划开始事件负载 */
export interface PlanStartPayload {
  planId: string
  goal: string
  steps: PlanStep[]
  totalSteps: number
}

/** 计划步骤事件负载 */
export interface PlanStepPayload {
  planId: string
  index: number
  name: string
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  error?: string
}

/** 会话信息 */
export interface Session {
  id: string
  title: string
  createTime: string
  updateTime: string
}

/** 聊天消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  /** 消息元数据 JSON，含 reasoningContent / toolCalls / toolResponses，用于还原历史事件 */
  metadata?: string
  /**
   * 回合完整事件流 JSON（question + events 数组），
   * 按原始顺序记录思考/工具/计划/正文，刷新后据此还原整个回合，
   * 优先于 metadata 还原
   */
  events?: string
  createTime: string
}

/** 消息查询参数（对齐后端 PageQuery 的 pageNum/pageSize） */
export interface MessageQuery {
  sessionId: string
  pageNum?: number
  pageSize?: number
}

/** 计划模板 */
export interface PlanTemplate {
  id: string | number
  name: string
  description?: string
  goal: string
  stepsJson: string
  createTime?: string
  updateTime?: string
}

/** 工具调用信息（执行树叶子节点） */
export interface ToolInfo {
  id: string | number
  toolName: string
  arguments?: string
  result?: string
  status: string
  durationMs?: number
}

/** Think-Act 记录（执行树一级节点） */
export interface ThinkAct {
  id: string | number
  round: number
  thinking?: string
  hasToolCall: boolean
  tools: ToolInfo[]
}

/** 执行记录详情 */
export interface ExecutionRecord {
  id: string | number
  sessionId: string | number
  planId?: string | number
  agentType?: string
  question?: string
  state: string
  totalRounds: number
  toolCallCount: number
  llmCallCount: number
  costTokens?: number
  durationMs: number
  errorMessage?: string
  createTime?: string
  finishTime?: string
  thinkActs: ThinkAct[]
}

/** 用户交互输入请求负载 */
export interface InputRequestPayload {
  requestId: string
  question: string
  options?: string[]
}

/** SSE 事件回调 */
export interface SSECallbacks {
  onContent?: (content: string) => void
  onReasoning?: (content: string) => void
  onToolCall?: (content: string) => void
  onToolContent?: (content: string) => void
  onStatus?: (content: string) => void
  onNotice?: (content: string) => void
  onPlanStart?: (content: string) => void
  onPlanStep?: (content: string) => void
  onPlanDone?: (content: string) => void
  onInputRequest?: (payload: InputRequestPayload) => void
  onDone?: () => void
  onError?: (error: string) => void
}
