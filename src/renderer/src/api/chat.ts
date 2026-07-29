import api from './index'
import type {
  ApiResponse,
  ChatRequest,
  Session,
  ChatMessage,
  MessageQuery,
  PageResult,
  SSECallbacks
} from '@renderer/types'

const abortControllers = new Map<string, AbortController>()

export const chatApi = {
  chat(request: ChatRequest, callbacks: SSECallbacks): AbortController {
    const controller = new AbortController()
    abortControllers.set(request.sessionId, controller)

    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          callbacks.onError?.(`HTTP ${response.status}: ${response.statusText}`)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
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
                    case 'DONE':
                      callbacks.onDone?.()
                      break
                    case 'ERROR':
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
          if (err instanceof Error && err.name === 'AbortError') return
          callbacks.onError?.(String(err))
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        callbacks.onError?.(String(err))
      })

    return controller
  },

  async interrupt(sessionId: string): Promise<void> {
    const controller = abortControllers.get(sessionId)
    if (controller) {
      controller.abort()
      abortControllers.delete(sessionId)
    }
    await api.post(`/ai/chat/interrupt/${sessionId}`).then((res) => res.data)
  },

  listSessions(): Promise<ApiResponse<Session[]>> {
    return api.get('/ai/sessions').then((res) => res.data)
  },

  getSession(sessionId: string): Promise<ApiResponse<Session>> {
    return api.get(`/ai/sessions/${sessionId}`).then((res) => res.data)
  },

  getMessages(query: MessageQuery): Promise<ApiResponse<PageResult<ChatMessage>>> {
    return api
      .get(`/ai/sessions/${query.sessionId}/messages`, {
        params: { page: query.page, size: query.size }
      })
      .then((res) => res.data)
  },

  deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return api.delete(`/ai/sessions/${sessionId}`).then((res) => res.data)
  },

  generateId(): Promise<ApiResponse<string>> {
    return api.get('/ai/sessions/generate-id').then((res) => res.data)
  }
}
