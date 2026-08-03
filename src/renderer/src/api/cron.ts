import api from './index'
import type { ApiResponse } from '@renderer/types'

/** 定时任务 */
export interface CronTask {
  id: number
  taskName: string
  cronExpression: string
  taskDescription?: string
  /** 0-禁用, 1-启用 */
  status: number
  createTime?: string
  lastExecutedTime?: string
  /** 下次触发时间 */
  nextExecTime?: string
}

export interface CronTaskForm {
  taskName: string
  cronExpression: string
  taskDescription?: string
}

export const cronApi = {
  list(): Promise<ApiResponse<CronTask[]>> {
    return api.get('/ai/cron-tasks').then((res) => res.data)
  },

  create(data: CronTaskForm): Promise<ApiResponse<CronTask>> {
    return api.post('/ai/cron-tasks', data).then((res) => res.data)
  },

  update(id: number, data: CronTaskForm): Promise<ApiResponse<void>> {
    return api.put(`/ai/cron-tasks/${id}`, data).then((res) => res.data)
  },

  updateStatus(id: number, status: number): Promise<ApiResponse<void>> {
    return api
      .put(`/ai/cron-tasks/${id}/status`, null, { params: { status } })
      .then((res) => res.data)
  },

  remove(id: number): Promise<ApiResponse<void>> {
    return api.delete(`/ai/cron-tasks/${id}`).then((res) => res.data)
  }
}
