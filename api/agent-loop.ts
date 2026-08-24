import { executeTool, getTool } from './tools'
import { getLLMProvider } from './providers'
import { validateToolPermission } from './policy'

export type LoopInput = { agent: any; tenantId: string; userId: string; input: unknown; maxIterations?: number }
type Decision = { final?: string; tool?: { name: string; input: unknown } }
function parseDecision(text: string): Decision { try { const parsed = JSON.parse(text); if (parsed?.tool?.name) return parsed as Decision; if (typeof parsed?.final === 'string') return parsed as Decision } catch {} return { final: text } }
export async function executeAgentLoop({ agent, tenantId, userId, input, maxIterations = 5 }: LoopInput) {
  const provider = getLLMProvider(), allowed = new Set((agent.tools || []).map(String)); let context = typeof input === 'string' ? input : JSON.stringify(input); let totalInput = 0, totalOutput = 0; const trace: any[] = []
  for (let iteration = 1; iteration <= Math.min(Math.max(maxIterations, 1), 10); iteration++) {
    const toolInstructions = allowed.size ? `اگر نیاز به ابزار داری فقط JSON زیر را برگردان: {"tool":{"name":"TOOL_NAME","input":{}}}. ابزارهای مجاز: ${[...allowed].join(', ')}. در غیر این صورت: {"final":"پاسخ نهایی"}.` : 'فقط JSON زیر را برگردان: {"final":"پاسخ نهایی"}.'
    const response = await provider.generate({ system: `${agent.systemPrompt || `You are ${agent.name}.`}\n${toolInstructions}`, prompt: context, temperature: 0.1, maxTokens: 1200 }); totalInput += response.inputTokens || 0; totalOutput += response.outputTokens || 0
    const decision = parseDecision(response.text); trace.push({ iteration, provider: response.provider, model: response.model, decision })
    if (decision.final !== undefined) return { text: decision.final, iterations: iteration, tokensUsed: totalInput + totalOutput, trace }
    if (!decision.tool?.name || !allowed.has(decision.tool.name)) throw new Error('TOOL_NOT_ALLOWED')
    const tool = getTool(decision.tool.name); if (!tool) throw new Error('TOOL_NOT_FOUND'); validateToolPermission(agent, tool)
    const result = await executeTool(decision.tool.name, decision.tool.input, { tenantId, userId }); context = `${context}\n\nTOOL ${decision.tool.name} RESULT:\n${JSON.stringify(result)}`
  }
  throw new Error('MAX_ITERATIONS_REACHED')
}
