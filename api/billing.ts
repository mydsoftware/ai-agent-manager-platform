import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

export const MIN_TOPUP_IRR = 10_000
export const MAX_TOPUP_IRR = 500_000_000
export const IRR_PER_CREDIT = 1_000

type EnvLike = Record<string, string | undefined>

export function validateTopupAmount(amount: unknown, env: EnvLike = process.env): number | null {
  const max = Number(env.MAX_TOPUP_IRR) || MAX_TOPUP_IRR
  const min = Math.min(Number(env.MIN_TOPUP_IRR) || MIN_TOPUP_IRR, max)
  const value = Math.floor(Number(amount))
  if (!Number.isFinite(value) || value < min || value > max) return null
  return value
}

export function creditsForAmount(amount: number, env: EnvLike = process.env): number {
  const perCredit = Number(env.IRR_PER_CREDIT) || IRR_PER_CREDIT
  if (perCredit <= 0) return 0
  return Math.max(1, Math.floor(amount / perCredit))
}

export function stubAutoSuccessEnabled(env: EnvLike = process.env): boolean {
  if (env.NODE_ENV === 'production') return false
  return env.PAYMENT_STUB_AUTO_SUCCESS === 'true'
}

export type CheckoutInput = { tenantId: string; userId: string; amount: number }

export async function createCheckout(prisma: PrismaClient, input: CheckoutInput, env: EnvLike = process.env) {
  const amount = validateTopupAmount(input.amount, env)
  if (!amount) throw new Error('INVALID_AMOUNT')

  const provider = (env.PAYMENT_PROVIDER || 'stub').toLowerCase()

  if (provider === 'stub') {
    if (!stubAutoSuccessEnabled(env)) throw new Error('PAYMENT_STUB_DISABLED')
    const credits = creditsForAmount(amount, env)
    const refId = `stub_${randomUUID().replace(/-/g, '').slice(0, 16)}`
    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: { userId: input.userId, tenantId: input.tenantId, amount, currency: 'IRR', status: 'SUCCESS', provider, refId },
      }),
      prisma.tenant.update({ where: { id: input.tenantId }, data: { credits: { increment: credits } } }),
    ])
    return { payment, credited: credits, redirectUrl: null }
  }

  const payment = await prisma.payment.create({
    data: { userId: input.userId, tenantId: input.tenantId, amount, currency: 'IRR', status: 'PENDING', provider },
  })
  throw Object.assign(new Error('PAYMENT_PROVIDER_NOT_IMPLEMENTED'), { paymentId: payment.id })
}
