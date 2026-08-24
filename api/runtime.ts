import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export type AgentRuntimeInput = {
  agentId: string
  tenantId: string
  input: unknown
  maxIterations?: number
}

export async function runAgent(input: AgentRuntimeInput) {
  const maxIterations = Math.min(Math.max(Number(input.maxIterations ?? 3), 1), 10)
  const agent = await prisma.agent.findFirst({ where: { id: input.agentId, tenantId: input.tenantId, isActive: true } })
  if (!agent) throw new Error('AGENT_NOT_FOUND')

  const run = await prisma.agentRun.create({ data: { agentId: agent.id, tenantId: input.tenantId, status: 'RUNNING', input: input.input as any, startedAt: new Date() } })
  try {
    // هسته اجرای فعلی provider-agnostic است؛ اتصال مدل در مرحله بعد از طریق Adapter انجام می‌شود.
    const output = { ok: true, agentId: agent.id, agent: agent.name, input: input.input, iterations: 1, message: 'Agent runtime initialized; LLM adapter is not configured.' }
    const finished = await prisma.agentRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', output, iterations: Math.min(1, maxIterations), finishedAt: new Date() } })
    return finished
  } catch (error: any) {
    return prisma.agentRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: error?.message || 'AGENT_RUN_FAILED', finishedAt: new Date() } })
  }
}
