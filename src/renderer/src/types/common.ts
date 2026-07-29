/**
 * 通用类型定义
 */

/** API 响应包装 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页参数 */
export interface PageParams {
  page: number
  size: number
}

/** 分页响应（对应后端 PageInfo） */
export interface PageResult<T> {
  list: T[]
  total: number
  pages: number
}

/** 主题类型 */
export type ThemeType = 'light' | 'dark' | 'system'
