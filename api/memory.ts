import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export async function saveMemory(tenantId: string, agentId: string, content: string, metadata: any = {}) {
  return prisma.agentMemory.create({ data: { tenantId, agentId, content, metadata } })
}
export async function listMemories(tenantId: string, agentId: string, limit = 20) {
  return prisma.agentMemory.findMany({ where: { tenantId, agentId }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 100) })
}
