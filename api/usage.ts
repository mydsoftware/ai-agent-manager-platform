import { PrismaClient } from '@prisma/client'
const g = globalThis as unknown as { prisma?: PrismaClient }
const prisma = g.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') g.prisma = prisma
export async function getUsage(tenantId: string) {
  const [runs, aggregate, agents] = await Promise.all([
    prisma.agentRun.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.agentRun.aggregate({ where: { tenantId }, _sum: { tokensUsed: true, creditsUsed: true }, _count: { id: true } }),
    prisma.agent.count({ where: { tenantId } })
  ])
  return { totalRuns: aggregate._count.id, agents, tokensUsed: aggregate._sum.tokensUsed || 0, creditsUsed: aggregate._sum.creditsUsed || 0, recentRuns: runs }
}
