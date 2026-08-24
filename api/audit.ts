import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export async function audit(tenantId: string, userId: string, action: string, resource: string, metadata: any = {}) {
  return prisma.auditLog.create({ data: { tenantId, userId, action, resource, metadata } })
}
