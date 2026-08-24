import { prisma } from './runtime'
import { createEmbedding } from './embeddings'

function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0, aa = 0, bb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i] }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0
}

export async function semanticRetrieve(agentId: string, tenantId: string, query: string, limit = 8) {
  const q = await createEmbedding(query)
  const memories = await prisma.agentMemory.findMany({ where: { agentId, tenantId }, orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, content: true, metadata: true, createdAt: true } })
  return memories.map((m: any) => ({ ...m, score: Array.isArray(m.metadata?.embedding) ? cosine(q.vector, m.metadata.embedding) : 0 })).sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime()).slice(0, Math.min(Math.max(limit, 1), 20))
}

export async function saveSemanticMemory(agentId: string, tenantId: string, content: string, metadata: Record<string, unknown> = {}) {
  const embedding = await createEmbedding(content)
  return prisma.agentMemory.create({ data: { agentId, tenantId, content: String(content).trim(), metadata: { ...metadata, embedding: embedding.vector, embeddingModel: embedding.model } as any } })
}
