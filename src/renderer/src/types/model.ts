/**
 * 模型相关类型定义
 */

/** AI 厂商 */
export interface AiProvider {
  id: number
  name: string
  code: string
  apiKey?: string
  baseUrl?: string
  sortOrder: number
  createTime?: string
}

/** AI 模型详情（完整字段） */
export interface AiModel {
  id: number
  providerId: number
  name: string
  isDefault: number
  sortOrder: number
  isEnabled: number
  apiKey?: string
  baseUrl?: string
  createTime?: string
}

/** 启用模型（列表选择用，精简字段） */
export interface AiModelEnabled {
  id: number
  providerId: number
  name: string
}

/** 模型列表（管理用） */
export interface AiModelList {
  id: number
  providerId: number
  name: string
  isDefault: number
  sortOrder: number
  isEnabled: number
  apiKey?: string
  baseUrl?: string
}

/** AI 配置 */
export interface AiConfig {
  id: number
  configKey: string
  configValue: string
  description?: string
  createTime?: string
}

/** 厂商及其关联模型（管理用） */
export interface AiProviderWithModels extends AiProvider {
  models: AiModelList[]
}

/** 模型精简信息（选择器用） */
export interface ModelSimple {
  id: number
  name: string
  isDefault: number
}

/** 厂商及精简模型列表（选择器用） */
export interface ProviderWithSimpleModels {
  id: number
  name: string
  code: string
  models: ModelSimple[]
}

/** MCP 配置 */
export interface AiMcpConfig {
  id: number
  name: string
  transportType: string
  baseUrl?: string
  endpoint?: string
  headers?: string
  command?: string
  args?: string
  env?: string
  requestTimeout: number
  connectionStatus: number
  errorMessage?: string
  connectedTime?: number
}
