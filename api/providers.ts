export type LLMRequest = { model?: string; system?: string; prompt: string; temperature?: number; maxTokens?: number }
export type LLMResponse = { text: string; inputTokens?: number; outputTokens?: number; provider: string; model: string }

export interface LLMProvider { name: string; generate(request: LLMRequest): Promise<LLMResponse> }

class OpenAICompatibleProvider implements LLMProvider {
  constructor(public name: string, private baseUrl: string, private apiKey: string, private defaultModel: string) {}
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const messages = [...(request.system ? [{ role: 'system', content: request.system }] : []), { role: 'user', content: request.prompt }]
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: request.model || this.defaultModel, messages, temperature: request.temperature ?? 0.2, max_tokens: request.maxTokens ?? 1200 }) })
    if (!response.ok) throw new Error(`${this.name.toUpperCase()}_ERROR_${response.status}`)
    const data: any = await response.json(); const choice = data?.choices?.[0]; if (!choice?.message?.content) throw new Error(`${this.name.toUpperCase()}_EMPTY_RESPONSE`)
    return { text: String(choice.message.content), inputTokens: data?.usage?.prompt_tokens, outputTokens: data?.usage?.completion_tokens, provider: this.name, model: String(data?.model || request.model || this.defaultModel) }
  }
}

export function getLLMProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY_NOT_CONFIGURED')
    return new OpenAICompatibleProvider('openai', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL || 'gpt-4o-mini')
  }
  if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY_NOT_CONFIGURED')
    return new OpenAICompatibleProvider('openrouter', process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini')
  }
  if (provider === 'custom') {
    if (!process.env.LLM_API_KEY || !process.env.LLM_BASE_URL) throw new Error('CUSTOM_LLM_NOT_CONFIGURED')
    return new OpenAICompatibleProvider('custom', process.env.LLM_BASE_URL, process.env.LLM_API_KEY, process.env.LLM_MODEL || 'default')
  }
  throw new Error('UNSUPPORTED_LLM_PROVIDER')
}
