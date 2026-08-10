import api from './index'
import type { ApiResponse, PlanTemplate, ExecutionRecord } from '@renderer/types'

/** 执行快照 */
export interface ExecutionSnapshot {
  id: string | number
  sessionId: string | number
  executionId?: string | number
  agentName?: string
  round?: number
  agentPrompt?: string
  state: string
  createTime?: string
}

/** 计划模板历史版本 */
export interface PlanTemplateVersion {
  id: string | number
  templateId: string | number
  version: number
  name: string
  description?: string
  goal: string
  stepsJson: string
  createTime?: string
}

/** 计划模板与执行记录接口 */
export const planApi = {
  // ---------- 执行记录 ----------

  /** 查询一次执行记录的完整执行树 */
  executionDetail(executionId: string | number): Promise<ApiResponse<ExecutionRecord>> {
    return api.get(`/ai/plan/execution/${executionId}`).then((res) => res.data)
  },

  /** 查询某会话最近一次执行记录 */
  latestBySession(sessionId: string): Promise<ApiResponse<ExecutionRecord>> {
    return api.get('/ai/plan/execution/latest', { params: { sessionId } }).then((res) => res.data)
  },

  /** 分页查询执行记录列表（不含明细） */
  pageExecutions(params: {
    sessionId?: string
    page?: number
    size?: number
  }): Promise<ApiResponse<ExecutionRecord[]>> {
    return api.get('/ai/plan/execution', { params }).then((res) => res.data)
  },

  // ---------- 执行快照 ----------

  /** 从执行记录创建快照 */
  createSnapshot(executionId: string | number): Promise<ApiResponse<string | number>> {
    return api.post(`/ai/plan/execution/${executionId}/snapshot`).then((res) => res.data)
  },

  /** 查询某会话的快照列表 */
  listSnapshots(sessionId: string | number): Promise<ApiResponse<ExecutionSnapshot[]>> {
    return api.get('/ai/plan/snapshot', { params: { sessionId } }).then((res) => res.data)
  },

  /** 删除快照 */
  deleteSnapshot(snapshotId: string | number): Promise<ApiResponse<void>> {
    return api.delete(`/ai/plan/snapshot/${snapshotId}`).then((res) => res.data)
  },

  // ---------- 计划模板 ----------

  listTemplates(): Promise<ApiResponse<PlanTemplate[]>> {
    return api.get('/ai/plan/template').then((res) => res.data)
  },

  getTemplate(id: string | number): Promise<ApiResponse<PlanTemplate>> {
    return api.get(`/ai/plan/template/${id}`).then((res) => res.data)
  },

  createTemplate(data: Partial<PlanTemplate>): Promise<ApiResponse<PlanTemplate>> {
    return api.post('/ai/plan/template', data).then((res) => res.data)
  },

  updateTemplate(
    id: string | number,
    data: Partial<PlanTemplate>
  ): Promise<ApiResponse<PlanTemplate>> {
    return api.put(`/ai/plan/template/${id}`, data).then((res) => res.data)
  },

  deleteTemplate(id: string | number): Promise<ApiResponse<void>> {
    return api.delete(`/ai/plan/template/${id}`).then((res) => res.data)
  },

  /** 查询模板历史版本 */
  listTemplateVersions(id: string | number): Promise<ApiResponse<PlanTemplateVersion[]>> {
    return api.get(`/ai/plan/template/${id}/versions`).then((res) => res.data)
  },

  /** 回滚模板到指定版本 */
  rollbackTemplate(
    id: string | number,
    versionId: string | number
  ): Promise<ApiResponse<PlanTemplate>> {
    return api.post(`/ai/plan/template/${id}/rollback/${versionId}`).then((res) => res.data)
  }
}
