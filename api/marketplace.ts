import { randomBytes } from 'node:crypto'
import type { PrismaClient, Prisma } from '@prisma/client'

export const MAX_LISTING_PRICE_CREDITS = 100_000
export const MAX_LISTING_TITLE_LENGTH = 120
export const MAX_LISTING_DESCRIPTION_LENGTH = 2000

export function validateListingPrice(value: unknown): number | null {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const price = Math.floor(num)
  if (price !== num || price < 0 || price > MAX_LISTING_PRICE_CREDITS) return null
  return price
}

export function validateListingTitle(title: unknown): string | null {
  const value = String(title ?? '').trim()
  if (!value || value.length > MAX_LISTING_TITLE_LENGTH) return null
  return value
}

export function cleanDescription(description: unknown): string | null {
  if (description === undefined || description === null) return null
  const value = String(description).trim()
  return value ? value.slice(0, MAX_LISTING_DESCRIPTION_LENGTH) : null
}

export function publicListing(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    priceCredits: row.priceCredits,
    salesCount: row.salesCount,
    agentName: row.agent?.name ?? null,
    createdAt: row.createdAt,
  }
}

export function cloneSlug(slug: string): string {
  const base = String(slug || 'agent').replace(/[^a-z0-9-]/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'agent'
  return `${base}-c${randomBytes(3).toString('hex')}`
}

export async function publishListing(
  prisma: PrismaClient,
  input: { agentId: string; tenantId: string; userId: string; title: string; description?: string; priceCredits: number },
) {
  const price = validateListingPrice(input.priceCredits)
  if (price === null) throw new Error('INVALID_PRICE')
  const title = validateListingTitle(input.title)
  if (!title) throw new Error('INVALID_TITLE')
  const description = cleanDescription(input.description)

  return prisma.$transaction(async (tx) => {
    const agent = await tx.agent.findFirst({ where: { id: input.agentId, tenantId: input.tenantId, isActive: true } })
    if (!agent) throw new Error('AGENT_NOT_FOUND')
    const existing = await tx.publishedAgent.findUnique({ where: { agentId: agent.id } })
    if (existing && existing.status === 'ACTIVE') throw new Error('ALREADY_PUBLISHED')
    if (existing) {
      return tx.publishedAgent.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', title, description, priceCredits: price },
      })
    }
    return tx.publishedAgent.create({
      data: {
        agentId: agent.id,
        sellerTenantId: input.tenantId,
        sellerUserId: input.userId,
        title,
        description,
        priceCredits: price,
      },
    })
  })
}

export async function delistListing(prisma: PrismaClient, params: { listingId: string; sellerTenantId: string }) {
  const listing = await prisma.publishedAgent.findFirst({
    where: { id: params.listingId, sellerTenantId: params.sellerTenantId },
  })
  if (!listing) throw new Error('LISTING_NOT_FOUND')
  return prisma.publishedAgent.update({ where: { id: listing.id }, data: { status: 'DELISTED' } })
}

export async function listActiveListings(prisma: PrismaClient, limit = 50) {
  const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 100)
  const rows = await prisma.publishedAgent.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take,
    include: { agent: { select: { name: true } } },
  })
  return rows.map(publicListing)
}

function buildCloneInsert(agent: any, buyerTenantId: string) {
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  const tools = JSON.stringify(Array.isArray(agent.tools) ? agent.tools : [])
  const permissions = JSON.stringify(Array.isArray(agent.permissions) ? agent.permissions : [])
  return {
    id,
    execute: (tx: Prisma.TransactionClient) =>
      tx.$queryRaw`INSERT INTO agents (id, "tenantId", name, slug, description, "systemPrompt", tools, permissions, "riskLevel", "approvalPolicy", "isActive", "createdAt", "updatedAt")
        VALUES (${id}, ${buyerTenantId}, ${agent.name}, ${cloneSlug(agent.slug)}, ${agent.description}, ${agent.systemPrompt}, ${tools}::jsonb, ${permissions}::jsonb, ${agent.riskLevel}, ${agent.approvalPolicy}, true, NOW(), NOW())
        RETURNING *`,
  }
}

export async function buyListing(prisma: PrismaClient, params: { listingId: string; buyerTenantId: string; buyerUserId: string }) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.publishedAgent.findFirst({
      where: { id: params.listingId, status: 'ACTIVE' },
      include: { agent: true },
    })
    if (!listing) throw new Error('LISTING_NOT_FOUND')
    if (listing.sellerTenantId === params.buyerTenantId) throw new Error('CANNOT_BUY_OWN_LISTING')

    const prior = await tx.purchase.findUnique({
      where: { publishedId_buyerTenantId: { publishedId: listing.id, buyerTenantId: params.buyerTenantId } },
    })
    if (prior) throw new Error('ALREADY_PURCHASED')

    const price = listing.priceCredits
    if (price > 0) {
      const debited = await tx.tenant.updateMany({
        where: { id: params.buyerTenantId, credits: { gte: price } },
        data: { credits: { decrement: price } },
      })
      if (debited.count !== 1) throw new Error('INSUFFICIENT_CREDITS')
      await tx.tenant.update({ where: { id: listing.sellerTenantId }, data: { credits: { increment: price } } })
    }

    const clone = buildCloneInsert(listing.agent, params.buyerTenantId)
    const inserted = await clone.execute(tx)
    const clonedAgent = Array.isArray(inserted) ? inserted[0] : inserted

    await tx.publishedAgent.update({ where: { id: listing.id }, data: { salesCount: { increment: 1 } } })
    const purchase = await tx.purchase.create({
      data: {
        publishedId: listing.id,
        buyerTenantId: params.buyerTenantId,
        buyerUserId: params.buyerUserId,
        priceCredits: price,
        cloneAgentId: clonedAgent?.id ?? null,
      },
    })
    return { purchase, agent: clonedAgent, listing: { id: listing.id, title: listing.title, priceCredits: price } }
  })
}

export async function listPurchases(prisma: PrismaClient, buyerTenantId: string, limit = 50) {
  const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 100)
  return prisma.purchase.findMany({
    where: { buyerTenantId },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      published: { select: { title: true, priceCredits: true } },
      clonedAgent: { select: { id: true, name: true, slug: true } },
    },
  })
}
