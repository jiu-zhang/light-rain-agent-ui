import api from './index'
import type { ApiResponse } from '@renderer/types'

/** 定时任务日志 */
export interface CronTaskLog {
  id: number
  taskId: number
  taskName: string
  triggeredTime: string
  finishedTime?: string
  /** 执行状态：0-执行中, 1-成功, 2-失败 */
  status: number
  statusText: string
  /** 执行耗时（秒） */
  executionDuration?: number
  errorMessage?: string
  executionResult?: string
}

/** 分页查询参数 */
export interface CronTaskLogPageQuery {
  /** 页码（可选，默认1） */
  pageNum?: number
  /** 每页条数（可选，默认20） */
  pageSize?: number
  /** 任务ID（可选）
   * 当此字段有值时，查询指定任务的历史日志
   * 当此字段为空时，查询所有任务的最近日志
   */
  taskId?: number
}

/** 分页响应 */
export interface CronTaskLogPageResult {
  records: CronTaskLog[]
  total: number
  size: number
  current: number
  pages: number
}

export const cronTaskLogApi = {
  /**
   * 分页查询定时任务日志
   * 
   * @param params 查询参数
   * @returns 分页日志结果
   * @example
   * ```ts
   * // 查询所有任务的最近日志
   * cronTaskLogApi.pageLogs({ pageNum: 1, pageSize: 20 })
   * 
   * // 查询指定任务的执行历史
   * cronTaskLogApi.pageLogs({ 
   *   pageNum: 1, 
   *   pageSize: 20, 
   *   taskId: 123
   * })
   * ```
   */
  pageLogs(params: CronTaskLogPageQuery): Promise<ApiResponse<CronTaskLogPageResult>> {
    return api.get('/cron-task-logs/page', { 
      params: {
        pageNum: params.pageNum || 1,
        pageSize: params.pageSize || 20,
        taskId: params.taskId
      }
    }).then((res) => res.data)
  }
}