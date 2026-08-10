import api from './index'
import type {
  ApiResponse,
  AiProvider,
  AiProviderWithModels,
  ProviderWithSimpleModels
} from '@renderer/types'

export const providerApi = {
  listAll(): Promise<ApiResponse<AiProvider[]>> {
    return api.get('/ai/providers/list-all').then((res) => res.data)
  },

  listAllWithModels(): Promise<ApiResponse<AiProviderWithModels[]>> {
    return api.get('/ai/providers/with-models').then((res) => res.data)
  },

  listEnabledWithModels(): Promise<ApiResponse<ProviderWithSimpleModels[]>> {
    return api.get('/ai/providers/list-enabled-with-models').then((res) => res.data)
  },

  getById(id: number): Promise<ApiResponse<AiProvider>> {
    return api.get(`/ai/providers/${id}`).then((res) => res.data)
  },

  update(data: {
    id: number
    apiKey?: string
    baseUrl?: string
    sortOrder?: number
  }): Promise<ApiResponse<void>> {
    return api.put('/ai/providers', data).then((res) => res.data)
  }
}
