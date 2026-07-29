/**
 * Axios 实例配置
 * <p>
 * 配置基础 URL、请求/响应拦截器、超时时间等。
 * 生产环境下 Electron 从 file:// 加载页面，需要直接指定后端地址。
 * </p>
 */
import axios from 'axios'
import type { ApiResponse } from '@renderer/types'

/**
 * 在 JSON 字符串层面将超过安全整数范围的大数字转为字符串
 * <p>
 * JSON.parse 在调用 reviver 之前就已经把数字转为 JavaScript Number 了（精度已丢失）。
 * 因此必须在字符串解析前通过正则替换，给大数字加上引号。
 * </p>
 */
function protectLargeNumbers(json: string): string {
  // JSON.parse 在调用 reviver 之前就已丢失精度（数字被截断为 53 位）
  // 因此在字符串层面，将超过 15 位的大整数包上引号转为字符串
  return json.replace(
    /(:\s*|,\s*|\]\s*|\{\s*)(\d{16,})(\s*,|\s*\}|\s*\]|$)/g,
    '$1"$2"$3'
  )
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

/** 请求拦截器 */
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加 token 等认证信息
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/** 响应拦截器 */
api.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse
    if (data.code !== 200) {
      console.error('API Error:', data.message)
    }
    return response
  },
  (error) => {
    console.error('Request Error:', error.message)
    return Promise.reject(error)
  }
)

export default api

// 导出各模块 API
export { chatApi } from './chat'
export { modelApi } from './model'
export { providerApi } from './provider'
export { configApi } from './config'
