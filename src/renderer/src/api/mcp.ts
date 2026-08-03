import api from './index'
import type { ApiResponse } from '@renderer/types'

/** MCP 服务器配置 */
export interface McpConfig {
  id: number
  name: string
  /** SSE / STREAMABLE / STDIO */
  transportType: string
  baseUrl?: string
  endpoint?: string
  /** HTTP 请求头，JSON 字符串 */
  headers?: string
  /** STDIO 启动命令 */
  command?: string
  /** STDIO 参数，JSON 数组字符串 */
  args?: string
  /** STDIO 环境变量，JSON 对象字符串 */
  env?: string
  requestTimeout?: number
  /** 0-连接中, 1-已连接, 2-已断开 */
  connectionStatus: number
  errorMessage?: string
  connectedTime?: number
}

export interface McpConfigForm {
  name: string
  transportType: string
  baseUrl?: string
  endpoint?: string
  headers?: string
  command?: string
  args?: string
  env?: string
  requestTimeout?: number
}

export const mcpApi = {
  list(): Promise<ApiResponse<McpConfig[]>> {
    return api.get('/ai/mcp').then((res) => res.data)
  },

  create(data: McpConfigForm): Promise<ApiResponse<McpConfig>> {
    return api.post('/ai/mcp', data).then((res) => res.data)
  },

  update(id: number, data: McpConfigForm): Promise<ApiResponse<void>> {
    return api.put(`/ai/mcp/${id}`, data).then((res) => res.data)
  },

  remove(id: number): Promise<ApiResponse<void>> {
    return api.delete(`/ai/mcp/${id}`).then((res) => res.data)
  },

  connect(id: number): Promise<ApiResponse<void>> {
    return api.post(`/ai/mcp/${id}/connect`).then((res) => res.data)
  },

  disconnect(id: number): Promise<ApiResponse<void>> {
    return api.post(`/ai/mcp/${id}/disconnect`).then((res) => res.data)
  }
}
