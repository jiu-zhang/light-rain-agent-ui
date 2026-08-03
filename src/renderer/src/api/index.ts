/**
 * Axios 实例配置
 * <p>
 * 配置基础 URL、请求/响应拦截器、超时时间等。
 * 开发环境通过 Vite proxy 转发到后端；生产环境由主进程启动后端后通知端口。
 * </p>
 * <p>
 * 业务错误（code !== 200）与网络错误统一在此 reject 为 {@link ApiError}，
 * 并自动弹出错误提示，调用方只需 try/catch。
 * </p>
 */
import axios from 'axios'
import type { ApiResponse } from '@renderer/types'
import { notifyError } from '@renderer/utils/feedback'

/** 统一业务异常 */
export class ApiError extends Error {
  /** 业务错误码；-1 表示网络/HTTP 层错误 */
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * 在 JSON 字符串层面将超过安全整数范围的大数字转为字符串
 * <p>
 * JSON.parse 在调用 reviver 之前就已经把数字转为 JavaScript Number 了（精度已丢失）。
 * 因此必须在字符串解析前通过正则替换，给大数字加上引号。
 * </p>
 */
function protectLargeNumbers(json: string): string {
  return json.replace(/(:\s*|,\s*|\]\s*|\{\s*)(\d{16,})(\s*,|\s*\}|\s*\]|$)/g, '$1"$2"$3')
}

/** 将 axios 层错误转换为对用户友好的提示文案 */
function normalizeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return '请求超时，请稍后重试'
    if (!error.response) return '无法连接后端服务，请确认服务已启动'
    const status = error.response.status
    return status >= 500 ? `服务器错误 (${status})` : `请求失败 (${status})`
  }
  return error instanceof Error ? error.message : '未知错误'
}

/** axios 实例 */
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  transformResponse: [
    (data) => {
      if (typeof data === 'string' && data) {
        try {
          return JSON.parse(protectLargeNumbers(data))
        } catch {
          return data
        }
      }
      return data
    }
  ]
})

/**
 * 响应拦截器：统一处理业务错误码与网络错误
 * <p>
 * 非 200 业务码与 HTTP/网络错误一律 reject 为 {@link ApiError} 并弹出提示，
 * 调用方无需再判断 res.code。
 * </p>
 */
api.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse
    if (data && typeof data === 'object' && 'code' in data && data.code !== 200) {
      const err = new ApiError(data.code, data.message || '请求失败')
      notifyError(err.message)
      return Promise.reject(err)
    }
    return response
  },
  (error) => {
    // 主动取消的请求不提示
    if (axios.isCancel(error)) return Promise.reject(error)
    const message = normalizeError(error)
    notifyError(message)
    return Promise.reject(new ApiError(-1, message))
  }
)

/**
 * 更新后端地址（由主进程通知端口后调用）
 * 生产环境 Electron 从 file:// 加载页面，需要直接指定后端地址。
 */
export function setBackendPort(port: number): void {
  api.defaults.baseURL = `http://127.0.0.1:${port}`
}

export default api

// 直接引入各模块（不通过 barrel export 避免循环依赖）
export { chatApi } from './chat'
export { modelApi } from './model'
export { providerApi } from './provider'
