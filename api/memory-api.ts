import { PrismaClient } from '@prisma/client'
const g = globalThis as unknown as { prisma?: PrismaClient }
const prisma = g.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') g.prisma = prisma
export async function searchMemory(tenantId: string, agentId: string, query: string, limit = 8) {
  const rows = await prisma.agentMemory.findMany({ where: { tenantId, agentId }, orderBy: { createdAt: 'desc' }, take: 100 })
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  return rows.map(row => ({ row, score: terms.reduce((s, t) => s + (row.content.toLowerCase().includes(t) ? 1 : 0), 0) })).filter(x => x.score > 0).sort((a,b) => b.score - a.score || b.row.createdAt.getTime() - a.row.createdAt.getTime()).slice(0, Math.min(Math.max(limit,1),20)).map(x => x.row)
}
export async function addMemory(tenantId: string, agentId: string, content: string, metadata: any = {}) {
  if (!content.trim()) throw new Error('EMPTY_MEMORY')
  return prisma.agentMemory.create({ data: { tenantId, agentId, content: content.trim().slice(0, 20000), metadata } })
}
