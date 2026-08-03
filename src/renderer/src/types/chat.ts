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
  createTime: string
}

/** 消息查询参数 */
export interface MessageQuery {
  sessionId: string
  page?: number
  size?: number
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
  onPlanStart?: (content: string) => void
  onPlanStep?: (content: string) => void
  onPlanDone?: (content: string) => void
  onInputRequest?: (payload: InputRequestPayload) => void
  onDone?: () => void
  onError?: (error: string) => void
}
