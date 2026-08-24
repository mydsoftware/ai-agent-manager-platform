import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export async function getUsage(tenantId: string) {
  const [runs, aggregate] = await Promise.all([
    prisma.agentRun.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.agentRun.aggregate({ where: { tenantId }, _sum: { tokensUsed: true, creditsUsed: true }, _count: { id: true } })
  ])
  return { totalRuns: aggregate._count.id, tokensUsed: aggregate._sum.tokensUsed || 0, creditsUsed: aggregate._sum.creditsUsed || 0, recentRuns: runs }
}
