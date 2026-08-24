export type EmbeddingResult = { vector: number[]; model: string; provider: string }

export async function createEmbedding(input: string): Promise<EmbeddingResult> {
  const text = String(input || '').trim()
  if (!text || text.length > 20000) throw new Error('INVALID_EMBEDDING_INPUT')
  const baseUrl = process.env.EMBEDDING_BASE_URL
  const apiKey = process.env.EMBEDDING_API_KEY
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
  if (!baseUrl || !apiKey) throw new Error('EMBEDDING_PROVIDER_NOT_CONFIGURED')
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, input: text }) })
  if (!response.ok) throw new Error(`EMBEDDING_PROVIDER_ERROR_${response.status}`)
  const data: any = await response.json()
  const vector = data?.data?.[0]?.embedding
  if (!Array.isArray(vector) || !vector.length) throw new Error('EMBEDDING_EMPTY_RESPONSE')
  return { vector: vector.map(Number), model: String(data?.model || model), provider: baseUrl }
}
