import { PrismaClient } from '@prisma/client'
import { getLLMProvider } from './providers'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export type AgentRuntimeInput = { agentId: string; tenantId: string; input: unknown; maxIterations?: number }

export async function runAgent(input: AgentRuntimeInput) {
  const maxIterations = Math.min(Math.max(Number(input.maxIterations ?? 3), 1), 10)
  const agent = await prisma.agent.findFirst({ where: { id: input.agentId, tenantId: input.tenantId, isActive: true } })
  if (!agent) throw new Error('AGENT_NOT_FOUND')
  const run = await prisma.agentRun.create({ data: { agentId: agent.id, tenantId: input.tenantId, status: 'RUNNING', input: input.input as any, startedAt: new Date() } })
  try {
    const provider = getLLMProvider()
    let prompt = typeof input.input === 'string' ? input.input : JSON.stringify(input.input)
    let finalText = ''
    let totalInput = 0, totalOutput = 0, iterations = 0
    for (let i = 0; i < maxIterations; i++) {
      iterations++
      const result = await provider.generate({ system: agent.systemPrompt || `You are ${agent.name}. ${agent.description || ''}`, prompt, model: undefined })
      finalText = result.text; totalInput += result.inputTokens || 0; totalOutput += result.outputTokens || 0
      break
    }
    const creditsUsed = Math.max(1, Math.ceil((totalInput + totalOutput) / 1000))
    if (creditsUsed > 0) {
      const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } })
      if (!tenant || tenant.credits < creditsUsed) throw new Error('INSUFFICIENT_CREDITS')
    }
    const finished = await prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id: input.tenantId }, data: { credits: { decrement: creditsUsed } } })
      return tx.agentRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', output: { text: finalText, provider: provider.name }, tokensUsed: totalInput + totalOutput, creditsUsed, iterations, finishedAt: new Date() } })
    })
    return finished
  } catch (error: any) {
    return prisma.agentRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: error?.message || 'AGENT_RUN_FAILED', iterations: 0, finishedAt: new Date() } })
  }
}
