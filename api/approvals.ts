import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function createApproval(tenantId: string, userId: string, agentId: string, toolName: string, input: unknown) {
  const safeInput = typeof input === 'object' && input !== null ? input : { value: String(input ?? '') }
  return prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'APPROVAL_REQUESTED',
      resource: `agent:${agentId}:tool:${toolName}`,
      metadata: { status: 'PENDING', input: safeInput as any },
    },
  })
}

export async function resolveApproval(tenantId: string, userId: string, auditId: string, approved: boolean) {
  const row = await prisma.auditLog.findFirst({
    where: { id: auditId, tenantId, userId, action: 'APPROVAL_REQUESTED' },
  })
  if (!row) throw new Error('APPROVAL_NOT_FOUND')
  return prisma.auditLog.update({
    where: { id: auditId },
    data: {
      action: approved ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
      metadata: { ...(row.metadata as any), status: approved ? 'APPROVED' : 'REJECTED' },
    },
  })
}
