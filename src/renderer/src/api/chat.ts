import api from './index'
import type {
  ApiResponse,
  Attachment,
  ChatRequest,
  Session,
  ChatMessage,
  MessageQuery,
  PageResult,
  SSECallbacks
} from '@renderer/types'

export const chatApi = {
  /**
   * 上传聊天附件（图片等文件），返回附件描述（fileId 供对话引用）
   */
  async uploadAttachment(file: File): Promise<Attachment> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${api.defaults.baseURL}/ai/chat/upload`, {
      method: 'POST',
      body: form
    })
    if (!res.ok) {
      throw new Error(`上传失败 (HTTP ${res.status})`)
    }
    let data: ApiResponse<Attachment>
    try {
      data = (await res.json()) as ApiResponse<Attachment>
    } catch {
      throw new Error('上传响应解析失败')
    }
    if (data.code !== 200) {
      throw new Error(data.message || '上传失败')
    }
    return data.data as Attachment
  },

  chat(request: ChatRequest, callbacks: SSECallbacks): AbortController {
    const controller = new AbortController()
    // DONE/ERROR 是否已送达：用于判断流异常关闭时是否需要兜底清理 loading 状态
    let settled = false
    let aborted = false

    fetch(`${api.defaults.baseURL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          settled = true
          callbacks.onError?.(`HTTP ${response.status}: ${response.statusText}`)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          settled = true
          callbacks.onError?.('响应体不可读')
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed.startsWith(':')) continue
              if (trimmed.startsWith('data:')) {
                const jsonStr = trimmed.slice(5).trim()
                if (!jsonStr || jsonStr === '[DONE]') continue
                try {
                  const event = JSON.parse(jsonStr)
                  switch (event.type) {
                    case 'CONTENT':
                      callbacks.onContent?.(event.content || '')
                      break
                    case 'REASONING':
                      callbacks.onReasoning?.(event.content || '')
                      break
                    case 'TOOL_CALL':
                      callbacks.onToolCall?.(event.content || '')
                      break
                    case 'TOOL_CONTENT':
                      callbacks.onToolContent?.(event.content || '')
                      break
                    case 'STATUS':
                      callbacks.onStatus?.(event.content || '')
                      break
                    case 'NOTICE':
                      callbacks.onNotice?.(event.content || '')
                      break
                    case 'PLAN_START':
                      callbacks.onPlanStart?.(event.content || '')
                      break
                    case 'PLAN_STEP':
                      callbacks.onPlanStep?.(event.content || '')
                      break
                    case 'PLAN_DONE':
                      callbacks.onPlanDone?.(event.content || '')
                      break
                    case 'INPUT_REQUEST':
                      try {
                        callbacks.onInputRequest?.(JSON.parse(event.content || '{}'))
                      } catch {
                        // 忽略非法负载
                      }
                      break
                    case 'DONE':
                      settled = true
                      callbacks.onDone?.()
                      break
                    case 'ERROR':
                      settled = true
                      callbacks.onError?.(event.error || event.content || '未知错误')
                      break
                  }
                } catch {
                  // skip non-JSON
                }
              }
            }
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            aborted = true
            return
          }
          settled = true
          callbacks.onError?.(String(err))
        } finally {
          // 服务端在未发 DONE/ERROR 的情况下关闭了流（如客户端断开重连等）：
          // 兜底触发 onDone，避免 loading 状态卡死整个 UI
          if (!aborted && !settled) callbacks.onDone?.()
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          aborted = true
          return
        }
        settled = true
        callbacks.onError?.(String(err))
      })

    return controller
  },

  /** 通知后端中断当前 Agent/计划执行（SSE 中断由调用方主动 abort） */
  async interrupt(sessionId: string): Promise<void> {
    await api.post(`/ai/chat/interrupt/${sessionId}`).then((res) => res.data)
  },

  /** 提交 Agent 执行过程中的用户交互输入 */
  submitInput(sessionId: string, requestId: string, value: string): Promise<ApiResponse<void>> {
    return api.post(`/ai/chat/${sessionId}/input`, { requestId, value }).then((res) => res.data)
  },

  listSessions(): Promise<ApiResponse<Session[]>> {
    return api.get('/ai/sessions').then((res) => res.data)
  },

  listSessionsPage(pageNum: number, pageSize: number): Promise<ApiResponse<PageResult<Session>>> {
    return api.get('/ai/sessions/page', { params: { pageNum, pageSize } }).then((res) => res.data)
  },

  getSession(sessionId: string): Promise<ApiResponse<Session>> {
    return api.get(`/ai/sessions/${sessionId}`).then((res) => res.data)
  },

  getMessages(query: MessageQuery): Promise<ApiResponse<PageResult<ChatMessage>>> {
    return api
      .get(`/ai/sessions/${query.sessionId}/messages`, {
        params: { pageNum: query.pageNum, pageSize: query.pageSize }
      })
      .then((res) => res.data)
  },

  deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return api.delete(`/ai/sessions/${sessionId}`).then((res) => res.data)
  },

  renameSession(sessionId: string, title: string): Promise<ApiResponse<void>> {
    return api.put(`/ai/sessions/${sessionId}`, { title }).then((res) => res.data)
  },

  deleteLastAssistant(sessionId: string): Promise<ApiResponse<void>> {
    return api.delete(`/ai/sessions/${sessionId}/messages/last-assistant`).then((res) => res.data)
  },

  generateId(): Promise<ApiResponse<string>> {
    return api.get('/ai/sessions/generate-id').then((res) => res.data)
  }
}
