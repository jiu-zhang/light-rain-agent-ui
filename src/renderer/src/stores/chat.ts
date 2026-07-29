/**
 * 聊天状态管理
 * <p>
 * 管理当前对话状态、消息列表、SSE 流式响应等。
 * </p>
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { chatApi } from '@renderer/api'
import type { ChatEvent, Session } from '@renderer/types'

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
    currentSessionId.value = sessionId
    messages.value = []
    await loadMessages(sessionId)
  }

  /** 加载会话历史消息 */
  async function loadMessages(sessionId: string): Promise<void> {
    try {
      const res = await chatApi.getMessages({ sessionId, page: 1, size: 100 })
      if (res.code === 200 && res.data?.list) {
        messages.value = res.data.list.map((msg) => ({
          type: 'CONTENT',
          content: msg.content,
          role: msg.role as 'user' | 'assistant' | 'tool' | undefined
        }))
      }
    } catch (e) {
      console.warn('加载消息历史失败:', e)
    }
  }

  /**
   * 如果 content 末尾有未闭合的 markdown 代码块标记，补全它，
   * 使得渲染时不会把后续内容吞入代码块。
   */
  function closeOpenCodeBlock(content: string): string {
    // 统计 ``` 出现次数：奇数个表示代码块未闭合
    const backtickCount = (content.match(/```/g) || []).length
    if (backtickCount % 2 !== 0) {
      return content + '\n```'
    }
    return content
  }

  /** 发送消息（使用 fetch POST + ReadableStream SSE） */
  function sendMessage(
    question: string,
    modelId?: string,
    agentMode = false
  ): void {
    if (!currentSessionId.value) return
    loading.value = true

    messages.value.push({ type: 'CONTENT', content: question, role: 'user' })

    let contentBuffer = ''

    abortController = chatApi.chat(
      {
        sessionId: currentSessionId.value,
        question,
        modelId,
        agentMode
      },
      {
        onContent(text) {
          contentBuffer += text
          updateLastMessage('CONTENT', contentBuffer)
        },
        onReasoning(text) {
          messages.value.push({ type: 'REASONING', content: text })
        },
        onToolCall(text) {
          // content 流被工具打断：补全当前消息中可能未闭合的代码块，重置缓冲区
          const last = messages.value[messages.value.length - 1]
          if (last && last.type === 'CONTENT' && last.role !== 'user') {
            last.content = closeOpenCodeBlock(last.content || '')
          }
          contentBuffer = ''
          messages.value.push({ type: 'TOOL_CALL', content: text })
        },
        onToolContent(text) {
          messages.value.push({ type: 'TOOL_CONTENT', content: text })
        },
        onStatus(text) {
          messages.value.push({ type: 'STATUS', content: text })
        },
        onDone() {
          loading.value = false
          abortController = null
        },
        onError(error) {
          messages.value.push({ type: 'ERROR', error })
          loading.value = false
          abortController = null
        }
      }
    )
  }

  /** 更新最后一条 CONTENT 消息或追加新消息 */
  function updateLastMessage(type: string, content: string): void {
    const last = messages.value[messages.value.length - 1]
    if (last && last.type === type && last.role !== 'user') {
      last.content = content
    } else {
      messages.value.push({ type: type as ChatEvent['type'], content, role: 'assistant' })
    }
  }

  /** 中断当前响应 */
  async function interrupt(): Promise<void> {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    if (currentSessionId.value) {
      await chatApi.interrupt(currentSessionId.value)
    }
    loading.value = false
  }

  /** 创建新会话 */
  async function createSession(): Promise<void> {
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
  }

  return {
    currentSessionId,
    sessions,
    messages,
    loading,
    loadSessions,
    switchSession,
    loadMessages,
    sendMessage,
    interrupt,
    createSession
  }
})
