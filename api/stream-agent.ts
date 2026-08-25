import { getLLMProvider } from './providers'
import { executeTool, getTool } from './tools'
import { validateToolPermission } from './policy'
import { retrieveMemory } from './rag'

export type StreamAgentInput = { agent: any; tenantId: string; userId: string; input: unknown; maxIterations?: number; memoryLimit?: number }
type StreamResult = { text: string; iterations: number; tokensUsed: number; trace: any[] }

function parseDecision(text: string): any {
  try { return JSON.parse(text) } catch { return { final: text } }
}

export async function streamAgent({ agent, tenantId, userId, input, maxIterations = 5, memoryLimit = 8 }: StreamAgentInput, emit: (event: any) => void): Promise<StreamResult> {
  const provider = getLLMProvider()
  const allowed = new Set((agent.tools || []).map(String))
  let context = typeof input === 'string' ? input : JSON.stringify(input)
  const memories = await retrieveMemory(agent.id, tenantId, context, memoryLimit)
  if (memories.length) context = `حافظه مرتبط Agent:\n${memories.map((m) => `- ${m.content}`).join('\n')}\n\nدرخواست فعلی:\n${context}`
  let totalInput = 0
  let totalOutput = 0
  const trace: any[] = []
  emit({ type: 'status', status: 'thinking' })
  for (let iteration = 1; iteration <= Math.min(Math.max(maxIterations, 1), 10); iteration++) {
    const instructions = allowed.size ? `اگر نیاز به ابزار داری فقط JSON زیر را برگردان: {"tool":{"name":"TOOL_NAME","input":{}}}. ابزارهای مجاز: ${[...allowed].join(', ')}. در غیر این صورت: {"final":"پاسخ نهایی"}.` : 'فقط JSON زیر را برگردان: {"final":"پاسخ نهایی"}.'
    emit({ type: 'status', status: 'thinking', iteration })
    const response = await provider.generate({ system: `${agent.systemPrompt || `You are ${agent.name}.`}\n${instructions}`, prompt: context, temperature: 0.1, maxTokens: 1200 })
    totalInput += response.inputTokens || 0
    totalOutput += response.outputTokens || 0
    emit({ type: 'provider', provider: response.provider, model: response.model, iteration })
    const decision = parseDecision(response.text)
    trace.push({ iteration, provider: response.provider, model: response.model, decision })
    if (decision.final !== undefined) {
      const text = String(decision.final)
      emit({ type: 'delta', text })
      emit({ type: 'done', iteration, usage: { inputTokens: totalInput, outputTokens: totalOutput } })
      return { text, iterations: iteration, tokensUsed: totalInput + totalOutput, trace }
    }
    if (!decision.tool?.name || !allowed.has(decision.tool.name)) throw new Error('TOOL_NOT_ALLOWED')
    const tool = getTool(decision.tool.name); if (!tool) throw new Error('TOOL_NOT_FOUND'); validateToolPermission(agent, tool)
    emit({ type: 'tool_start', name: decision.tool.name, input: decision.tool.input })
    const result = await executeTool(decision.tool.name, decision.tool.input, { tenantId, userId })
    emit({ type: 'tool_result', name: decision.tool.name, result })
    context = `${context}\n\nTOOL ${decision.tool.name} RESULT:\n${JSON.stringify(result)}`
  }
  throw new Error('MAX_ITERATIONS_REACHED')
}
