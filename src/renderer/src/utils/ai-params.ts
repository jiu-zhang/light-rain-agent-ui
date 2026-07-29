/**
 * AI 模型参数持久化管理
 */
export interface AiParams {
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  systemPrompt: string
}

const AI_PARAMS_KEY = 'agent-ui-ai-params'

const DEFAULT_PARAMS: AiParams = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,
  systemPrompt: ''
}

export function getAiParams(): AiParams {
  try {
    const raw = localStorage.getItem(AI_PARAMS_KEY)
    if (raw) return { ...DEFAULT_PARAMS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return { ...DEFAULT_PARAMS }
}

export function setAiParams(params: Partial<AiParams>): void {
  const current = getAiParams()
  const next = { ...current, ...params }
  localStorage.setItem(AI_PARAMS_KEY, JSON.stringify(next))
}
