import { describe, expect, it } from 'vitest'
import {
  MAX_LISTING_PRICE_CREDITS,
  cleanDescription,
  cloneSlug,
  publicListing,
  validateListingPrice,
  validateListingTitle,
} from '../api/marketplace'

describe('listing price validation', () => {
  it('accepts non-negative integer credits', () => {
    expect(validateListingPrice(0)).toBe(0)
    expect(validateListingPrice(50)).toBe(50)
    expect(validateListingPrice('120')).toBe(120)
    expect(validateListingPrice(MAX_LISTING_PRICE_CREDITS)).toBe(MAX_LISTING_PRICE_CREDITS)
  })
  it('rejects fractional, negative, and out-of-range values', () => {
    expect(validateListingPrice(10.5)).toBeNull()
    expect(validateListingPrice(-1)).toBeNull()
    expect(validateListingPrice(MAX_LISTING_PRICE_CREDITS + 1)).toBeNull()
    expect(validateListingPrice(Number.NaN)).toBeNull()
    expect(validateListingPrice('free')).toBeNull()
    expect(validateListingPrice(undefined)).toBeNull()
  })
})

describe('listing title validation', () => {
  it('accepts titles within the length limit including unicode', () => {
    expect(validateListingTitle(' دستیار فروش ')).toBe('دستیار فروش')
    expect(validateListingTitle('a'.repeat(MAX_LISTING_PRICE_CREDITS > 120 ? 120 : 10))).toHaveLength(120)
  })
  it('rejects empty or oversized titles', () => {
    expect(validateListingTitle('   ')).toBeNull()
    expect(validateListingTitle('')).toBeNull()
    expect(validateListingTitle('x'.repeat(121))).toBeNull()
  })
})

describe('description cleaning', () => {
  it('trims, truncates, and normalizes blanks to null', () => {
    expect(cleanDescription(' توضیحات ')).toBe('توضیحات')
    expect(cleanDescription('   ')).toBeNull()
    expect(cleanDescription(undefined)).toBeNull()
    expect(cleanDescription('x'.repeat(3000))).toHaveLength(2000)
  })
})

describe('public listing projection', () => {
  it('hides seller identity fields from buyers', () => {
    const row = {
      id: 'l1',
      title: 'عنوان',
      description: null,
      priceCredits: 25,
      salesCount: 3,
      createdAt: '2026-08-26',
      sellerTenantId: 'secret-tenant',
      sellerUserId: 'secret-user',
      agent: { name: 'پشتیبان' },
    }
    const view = publicListing(row) as any
    expect(view.agentName).toBe('پشتیبان')
    expect(view.priceCredits).toBe(25)
    expect(JSON.stringify(view)).not.toContain('secret-tenant')
    expect(JSON.stringify(view)).not.toContain('secret-user')
  })
})

describe('clone slug generation', () => {
  it('keeps base slug and appends unique suffix', () => {
    expect(cloneSlug('my-agent')).toMatch(/^my-agent-c[0-9a-f]{6}$/)
    expect(cloneSlug('نام فارسی')).toMatch(/^agent-c[0-9a-f]{6}$/)
  })
  it('generates distinct slugs across calls', () => {
    const set = new Set(Array.from({ length: 40 }, () => cloneSlug('base')))
    expect(set.size).toBeGreaterThan(35)
  })
})
