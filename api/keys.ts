import { randomBytes, createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export function generateApiKey() { const raw = `aam_${randomBytes(24).toString('hex')}`; return { raw, hash: createHash('sha256').update(raw).digest('hex') } }
export function hashApiKey(key: string) { return createHash('sha256').update(key).digest('hex') }
export async function findApiKey(key: string) {
  const hash = hashApiKey(key)
  return prisma.apiKey.findFirst({ where: { hash, revokedAt: null } })
}
