type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfter: 0 }
  }
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.resetAt - now) / 1000) }
  }
  current.count += 1
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfter: 0 }
}

export function rateLimitKey(c: any, scope: string) {
  const auth = c.req.header('authorization') || ''
  const forwarded = c.req.header('x-forwarded-for') || ''
  return `${scope}:${auth || forwarded || 'anonymous'}`
}
