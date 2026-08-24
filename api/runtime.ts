import { PrismaClient } from '@prisma/client'
import { executeAgentLoop } from './agent-loop'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export type AgentRuntimeInput = {
  agentId: string
  tenantId: string
  userId: string
  input: unknown
  maxIterations?: number
}

export async function runAgent(input: AgentRuntimeInput) {
  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      isActive: true,
      tenants: { some: { id: input.tenantId } },
    },
    select: { id: true },
  })
  if (!user) throw new Error('UNAUTHORIZED')

  const agent = await prisma.agent.findFirst({
    where: { id: input.agentId, tenantId: input.tenantId, isActive: true },
  })
  if (!agent) throw new Error('AGENT_NOT_FOUND')

  const run = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      tenantId: input.tenantId,
      status: 'RUNNING',
      input: input.input as any,
      startedAt: new Date(),
    },
  })

  const startedAt = Date.now()

  try {
    const result = await executeAgentLoop({
      agent,
      tenantId: input.tenantId,
      userId: input.userId,
      input: input.input,
      maxIterations: input.maxIterations,
    })

    const latencyMs = Date.now() - startedAt
    const creditsUsed = Math.max(1, Math.ceil(result.tokensUsed / 1000))
    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } })
    if (!tenant || tenant.credits < creditsUsed) throw new Error('INSUFFICIENT_CREDITS')

    const trace = Array.isArray(result.trace) ? result.trace : []
    const providers = [...new Set(trace.map((item: any) => item?.provider).filter(Boolean))]
    const models = [...new Set(trace.map((item: any) => item?.model).filter(Boolean))]
    const telemetry = {
      latencyMs,
      providers,
      models,
      iterations: result.iterations,
      tokensUsed: result.tokensUsed,
      creditsUsed,
      toolCalls: trace.filter((item: any) => item?.decision?.tool?.name).length,
    }

    return await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: input.tenantId },
        data: { credits: { decrement: creditsUsed } },
      })
      return tx.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          output: { text: result.text, trace, telemetry },
          tokensUsed: result.tokensUsed,
          creditsUsed,
          iterations: result.iterations,
          finishedAt: new Date(),
        },
      })
    })
  } catch (error: any) {
    return prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        error: error?.message || 'AGENT_RUN_FAILED',
        finishedAt: new Date(),
        output: { telemetry: { latencyMs: Date.now() - startedAt } },
      },
    })
  }
}
