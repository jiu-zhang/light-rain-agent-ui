import api from './index'
import type { ApiResponse, AiModel, AiModelEnabled, AiModelList } from '@renderer/types'

export const modelApi = {
  listEnabled(): Promise<ApiResponse<AiModelEnabled[]>> {
    return api.get('/ai/models/list-enabled').then((res) => res.data)
  },

  listByProvider(providerId: number): Promise<ApiResponse<AiModelList[]>> {
    return api
      .get('/ai/models/list-by-provider', { params: { providerId } })
      .then((res) => res.data)
  },

  getById(id: number): Promise<ApiResponse<AiModel>> {
    return api.get(`/ai/models/${id}`).then((res) => res.data)
  },

  add(data: Partial<AiModel>): Promise<ApiResponse<void>> {
    return api.post('/ai/models', data).then((res) => res.data)
  },

  update(data: Partial<AiModel> & { id: number }): Promise<ApiResponse<void>> {
    return api.put('/ai/models', data).then((res) => res.data)
  },

  delete(id: number): Promise<ApiResponse<void>> {
    return api.delete(`/ai/models/${id}`).then((res) => res.data)
  }
}
