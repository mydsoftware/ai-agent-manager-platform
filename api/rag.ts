import { prisma } from './runtime'

function terms(value: string) {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2).slice(0, 40)
}

export async function retrieveMemory(agentId: string, tenantId: string, query: string, limit = 8) {
  const memories = await prisma.agentMemory.findMany({
    where: { agentId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, content: true, metadata: true, createdAt: true }
  })
  const queryTerms = terms(query)
  const ranked = memories.map((memory) => {
    const contentTerms = new Set(terms(memory.content))
    const matches = queryTerms.reduce((score, term) => score + (contentTerms.has(term) ? 1 : 0), 0)
    return { ...memory, score: matches / Math.max(queryTerms.length, 1) }
  }).sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime())
  return ranked.slice(0, Math.min(Math.max(limit, 1), 20))
}

export async function saveMemory(agentId: string, tenantId: string, content: string, metadata: unknown = {}) {
  const value = String(content || '').trim()
  if (!value || value.length > 10000) throw new Error('INVALID_MEMORY')
  return prisma.agentMemory.create({ data: { agentId, tenantId, content: value, metadata: metadata as any } })
}
