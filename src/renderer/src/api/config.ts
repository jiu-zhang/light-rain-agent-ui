import api from './index'
import type { ApiResponse } from '@renderer/types'

/**
 * AI 系统配置（ai_config 表，全局生效，影响所有对话/Agent）
 */
export const configApi = {
  list(): Promise<ApiResponse<Record<string, string>>> {
    return api.get('/ai/configs').then((res) => res.data)
  },

  getByKeys(keys: string[]): Promise<ApiResponse<Record<string, string>>> {
    return api.post('/ai/configs/getByKeys', keys).then((res) => res.data)
  },

  save(configs: Record<string, string>): Promise<ApiResponse<void>> {
    return api.post('/ai/configs', configs).then((res) => res.data)
  }
}
