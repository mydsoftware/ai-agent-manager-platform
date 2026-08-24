import { describe, expect, it } from 'vitest'
import { rateLimit } from '../api/rate-limit'

describe('runtime security primitives', () => {
  it('isolates rate-limit buckets by key', () => {
    const a = 'test-a-' + Date.now()
    const b = 'test-b-' + Date.now()
    expect(rateLimit(a, 1, 60_000).allowed).toBe(true)
    expect(rateLimit(a, 1, 60_000).allowed).toBe(false)
    expect(rateLimit(b, 1, 60_000).allowed).toBe(true)
  })

  it('rejects the next request after a bucket reaches its limit', () => {
    const key = 'limit-' + Date.now()
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true)
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true)
    const blocked = rateLimit(key, 2, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1)
  })
})
