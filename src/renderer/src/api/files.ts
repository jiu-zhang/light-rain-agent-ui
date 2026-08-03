import api from './index'
import type { ApiResponse } from '@renderer/types'

/** 文件浏览器节点 */
export interface FileNode {
  name: string
  path: string
  isDir: boolean
  size?: number
  modified?: number
  children?: FileNode[]
}

/** 计划触达文件 */
export interface PlanFile {
  path: string
  name: string
  isDir: boolean
  operation: string
  exists: boolean
  executionId: string | number
}

export const fileApi = {
  /** 浏览工作区目录 */
  browse(path?: string, depth = 0): Promise<ApiResponse<FileNode[]>> {
    return api.get('/ai/files/browse', { params: { path, depth } }).then((res) => res.data)
  },

  /** 读取文件内容 */
  read(path: string): Promise<ApiResponse<{ path: string; size: number; content: string; lines: number }>> {
    return api.get('/ai/files/read', { params: { path } }).then((res) => res.data)
  },

  /** 查询某计划触达过的文件 */
  planFiles(planId: string | number): Promise<ApiResponse<PlanFile[]>> {
    return api.get(`/ai/files/plan/${planId}`).then((res) => res.data)
  }
}
