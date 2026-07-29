/**
 * 聊天相关类型定义
 */

/** 聊天事件类型 */
export type ChatEventType =
  'CONTENT' | 'REASONING' | 'TOOL_CALL' | 'TOOL_CONTENT' | 'STATUS' | 'DONE' | 'ERROR'

/** 聊天事件 */
export interface ChatEvent {
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
  metadata?: string
  createTime: string
}

/** 消息查询参数 */
export interface MessageQuery {
  sessionId: string
  page?: number
  size?: number
}

/** SSE 事件回调 */
export interface SSECallbacks {
  onContent?: (content: string) => void
  onReasoning?: (content: string) => void
  onToolCall?: (content: string) => void
  onToolContent?: (content: string) => void
  onStatus?: (content: string) => void
  onDone?: () => void
  onError?: (error: string) => void
}
