import { describe, expect, it, vi } from 'vitest'
import { createCheckout, creditsForAmount, stubAutoSuccessEnabled, validateTopupAmount } from '../api/billing'

describe('topup validation', () => {
  it('accepts valid amounts and floors decimals', () => {
    expect(validateTopupAmount(100_000)).toBe(100_000)
    expect(validateTopupAmount(99_999.9)).toBe(99_999)
  })
  it('rejects out-of-range and non-numeric input', () => {
    expect(validateTopupAmount(9_999)).toBeNull()
    expect(validateTopupAmount(500_000_001)).toBeNull()
    expect(validateTopupAmount(Number.NaN)).toBeNull()
    expect(validateTopupAmount('abc')).toBeNull()
    expect(validateTopupAmount(undefined)).toBeNull()
    expect(validateTopupAmount(-50_000)).toBeNull()
  })
  it('honors env-configured bounds', () => {
    const env = { MIN_TOPUP_IRR: '50_000'.replace('_', ''), MAX_TOPUP_IRR: '20000' }
    expect(validateTopupAmount(15_000, env)).toBeNull()
    expect(validateTopupAmount(20_000, env)).toBe(20_000)
  })
})

describe('credit conversion', () => {
  it('converts IRR to credits with floor', () => {
    expect(creditsForAmount(100_000)).toBe(100)
    expect(creditsForAmount(10_500)).toBe(10)
  })
  it('never converts below one credit', () => {
    expect(creditsForAmount(500)).toBe(1)
  })
})

describe('stub gateway safety', () => {
  it('auto-approves only outside production with explicit flag', () => {
    expect(stubAutoSuccessEnabled({ NODE_ENV: 'development', PAYMENT_STUB_AUTO_SUCCESS: 'true' })).toBe(true)
    expect(stubAutoSuccessEnabled({ NODE_ENV: 'production', PAYMENT_STUB_AUTO_SUCCESS: 'true' })).toBe(false)
    expect(stubAutoSuccessEnabled({ NODE_ENV: 'development' })).toBe(false)
  })
})

describe('createCheckout', () => {
  function makePrisma() {
    const payment = { id: 'p1', status: 'SUCCESS', amount: 100_000, currency: 'IRR', provider: 'stub', refId: 'stub_x' }
    return {
      payment: { create: vi.fn().mockResolvedValue(payment) },
      tenant: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
      created: payment,
    }
  }

  it('credits tenant atomically through stub provider', async () => {
    const prisma = makePrisma()
    const result = await createCheckout(prisma as any, { tenantId: 't1', userId: 'u1', amount: 100_000 }, { NODE_ENV: 'development', PAYMENT_STUB_AUTO_SUCCESS: 'true' })
    expect(result.credited).toBe(100)
    expect(result.redirectUrl).toBeNull()
    expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { credits: { increment: 100 } } })
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS', provider: 'stub' }) }))
  })

  it('rejects invalid amounts before touching database', async () => {
    const prisma = makePrisma()
    await expect(createCheckout(prisma as any, { tenantId: 't1', userId: 'u1', amount: 5 }, { NODE_ENV: 'development', PAYMENT_STUB_AUTO_SUCCESS: 'true' })).rejects.toThrow('INVALID_AMOUNT')
    expect(prisma.payment.create).not.toHaveBeenCalled()
  })

  it('refuses disabled stub instead of silently charging', async () => {
    const prisma = makePrisma()
    await expect(createCheckout(prisma as any, { tenantId: 't1', userId: 'u1', amount: 100_000 }, {})).rejects.toThrow('PAYMENT_STUB_DISABLED')
  })

  it('leaves PENDING payment for unimplemented gateways', async () => {
    const prisma = makePrisma()
    await expect(createCheckout(prisma as any, { tenantId: 't1', userId: 'u1', amount: 100_000 }, { PAYMENT_PROVIDER: 'zarinpal' })).rejects.toThrow('PAYMENT_PROVIDER_NOT_IMPLEMENTED')
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', provider: 'zarinpal' }) }))
    expect(prisma.tenant.update).not.toHaveBeenCalled()
  })
})
