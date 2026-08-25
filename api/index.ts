import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { runAgent, openMeteredRun } from './runtime'
import { streamAgent } from './stream-agent'
import { executeTool, getTool, listTools } from './tools'
import { getUsage } from './usage'
import { generateApiKey, findApiKey } from './keys'
import { createCheckout } from './billing'
import { publishListing, delistListing, listActiveListings, buyListing, listPurchases } from './marketplace'
import { resolveApproval } from './approvals'
import { searchMemory } from './memory-api'
import { retrieveMemory, saveMemory } from './rag'
import { rateLimit, rateLimitKey } from './rate-limit'
import { validateToolPermission } from './policy'

const app = new Hono().basePath('/api')
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
function db() { if (!process.env.DATABASE_URL) return null; if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient(); return globalForPrisma.prisma }
function jwtSecret() { const value = process.env.JWT_SECRET; if (value && value.length < 32) throw new Error('JWT_SECRET_TOO_SHORT'); if (!value) { if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET_NOT_CONFIGURED'); return new TextEncoder().encode('insecure-dev-secret-set-JWT_SECRET-before-prod') } return new TextEncoder().encode(value) }
async function signToken(payload: { sub: string; email: string }) { return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(jwtSecret()) }
async function verifyToken(token: string) { const { payload } = await jwtVerify(token, jwtSecret()); if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('invalid_token'); return payload as { sub: string; email: string } }
function authToken(c: any) { const value = c.req.header('authorization') || ''; return value.startsWith('Bearer ') ? value.slice(7) : '' }
async function requireUser(c: any) {
  const prisma = db(); if (!prisma) throw new Error('DATABASE_NOT_CONFIGURED')
  const apiKeyValue = String(c.req.header('x-api-key') || '')
  if (apiKeyValue.startsWith('aam_')) {
    const key = await findApiKey(apiKeyValue)
    if (!key) throw new Error('UNAUTHORIZED')
    const [keyUser, keyTenant] = await Promise.all([prisma.user.findUnique({ where: { id: key.userId } }), prisma.tenant.findUnique({ where: { id: key.tenantId } })])
    if (!keyUser || !keyUser.isActive || !keyTenant || keyTenant.status !== 'ACTIVE') throw new Error('UNAUTHORIZED')
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
    return { prisma, user: keyUser, tenant: keyTenant }
  }
  const token = authToken(c); if (!token) throw new Error('UNAUTHORIZED'); const payload = await verifyToken(token); const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { tenants: true } }); if (!user || !user.isActive) throw new Error('UNAUTHORIZED'); return { prisma, user, tenant: user.tenants[0] }
}
function limited(c: any, scope: string, limit = 60) { return rateLimit(rateLimitKey(c, scope), limit) }
const configuredOrigins = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean)
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
const defaultOrigins = ['https://mydsoftware.github.io','http://localhost:3000','http://127.0.0.1:3000']
app.use('*', cors({ origin: (origin) => { if (!origin) return '*'; if (configuredOrigins.includes('*')) return origin; if (configuredOrigins.includes(origin)) return origin; if (defaultOrigins.includes(origin)) return origin; if (origin.endsWith('.github.io')) return origin; if (origin.endsWith('.onrender.com')) return origin; return configuredOrigins[0] || origin }, credentials: true }))
app.get('/', (c) => c.json({ name: 'AI Agent Manager API', version: '0.8.2', status: 'ok', host: 'render' }))
app.get('/health', async (c) => { const prisma = db(); if (!prisma) return c.json({ status: 'ok', database: 'not_configured' }); try { await prisma.$queryRaw`SELECT 1`; return c.json({ status: 'ok', database: 'connected', time: new Date().toISOString() }) } catch (e: any) { return c.json({ status: 'degraded', database: 'error', error: e?.message || 'db_error' }, 503) } })
app.post('/auth/register', async (c) => { const rl = limited(c, 'register', 10); if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429); const prisma = db(); if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503); let body: any; try { body = await c.req.json() } catch { return c.json({ error: 'INVALID_JSON' }, 400) }; const email = String(body.email || '').trim().toLowerCase(), password = String(body.password || ''), name = body.name ? String(body.name).trim().slice(0, 120) : null; if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6 || password.length > 128) return c.json({ error: 'INVALID_INPUT' }, 400); try { if (await prisma.user.findUnique({ where: { email } })) return c.json({ error: 'EMAIL_ALREADY_EXISTS' }, 409); const passwordHash = await bcrypt.hash(password, 12); const role = adminEmails.includes(email) ? 'ADMIN' : 'USER'; const user = await prisma.user.create({ data: { email, passwordHash, name, role, tenants: { create: { name: name || email.split('@')[0], slug: `t-${Date.now().toString(36)}`, plan: 'FREE', credits: 100 } } }, include: { tenants: true } }); const token = await signToken({ sub: user.id, email }); const tenant = user.tenants[0]; return c.json({ token, user: { id: user.id, email, name: user.name, role: user.role }, tenant: tenant ? { id: tenant.id, name: tenant.name, credits: tenant.credits, plan: tenant.plan } : null }) } catch (e) { console.error(e); return c.json({ error: 'REGISTER_FAILED' }, 500) } })
app.post('/auth/login', async (c) => { const rl = limited(c, 'login', 20); if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429); const prisma = db(); if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503); let body: any; try { body = await c.req.json() } catch { return c.json({ error: 'INVALID_JSON' }, 400) }; const email = String(body.email || '').trim().toLowerCase(), password = String(body.password || ''); try { const user = await prisma.user.findUnique({ where: { email }, include: { tenants: true } }); if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return c.json({ error: 'INVALID_CREDENTIALS' }, 401); const token = await signToken({ sub: user.id, email }); const tenant = user.tenants[0]; return c.json({ token, user: { id: user.id, email, name: user.name, role: user.role }, tenant: tenant ? { id: tenant.id, name: tenant.name, credits: tenant.credits, plan: tenant.plan } : null }) } catch (e) { console.error(e); return c.json({ error: 'LOGIN_FAILED' }, 500) } })
app.get('/auth/me', async (c) => { try { const { user, tenant } = await requireUser(c); return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, isAdmin: user.role === 'ADMIN' }, tenant: tenant ? { id: tenant.id, name: tenant.name, credits: tenant.credits, plan: tenant.plan } : null }) } catch (e: any) { return c.json({ error: e?.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'AUTH_FAILED' }, 401) } })
app.post('/agents', async (c) => {
  try {
    const { prisma, tenant } = await requireUser(c)
    if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404)
    let body: any
    try { body = await c.req.json() } catch { return c.json({ error: 'INVALID_JSON' }, 400) }
    const name = String(body.name || '').trim()
    if (!name) return c.json({ error: 'INVALID_INPUT', message: 'name required' }, 400)
    let slug = String(body.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    if (!slug || slug === '-') slug = 'agent-' + Date.now().toString(36)
    slug = slug.slice(0, 48)
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    // Use raw SQL to avoid Prisma String[] vs JSONB mismatch on tools/permissions
    await prisma.$executeRaw`
      INSERT INTO agents (id, "tenantId", name, slug, description, "systemPrompt", tools, permissions, "riskLevel", "approvalPolicy", "isActive", "createdAt", "updatedAt")
      VALUES (
        ${id},
        ${tenant.id},
        ${name},
        ${slug},
        ${body.description ? String(body.description) : null},
        ${body.systemPrompt ? String(body.systemPrompt) : null},
        ${JSON.stringify(Array.isArray(body.tools) ? body.tools.map(String) : ['web_search'])}::jsonb,
        ${JSON.stringify(Array.isArray(body.permissions) ? body.permissions.map(String) : [])}::jsonb,
        ${body.riskLevel ? String(body.riskLevel) : 'LOW'},
        ${body.approvalPolicy ? String(body.approvalPolicy) : 'AUTO'},
        true,
        NOW(),
        NOW()
      )
    `
    const rows = await prisma.$queryRaw`SELECT * FROM agents WHERE id = ${id} LIMIT 1` as any[]
    return c.json({ agent: rows[0] || { id, name, slug, tenantId: tenant.id } }, 201)
  } catch (e: any) {
    console.error(e)
    return c.json({ error: e?.message || 'AGENT_CREATE_FAILED' }, 400)
  }
})
app.get('/agents', async (c) => {
  try {
    const { prisma, tenant } = await requireUser(c)
    if (!tenant) return c.json({ agents: [] })
    const agents = await prisma.$queryRaw`SELECT * FROM agents WHERE "tenantId" = ${tenant.id} ORDER BY "createdAt" DESC` as any[]
    return c.json({ agents: agents || [] })
  } catch (e: any) {
    return c.json({ error: e?.message || 'AGENT_LIST_FAILED' }, 401)
  }
})
app.post('/agents/:id/run', async (c) => { try { const { tenant, user } = await requireUser(c); if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404); let body: any = {}; try { body = await c.req.json() } catch {} const run = await runAgent({ agentId: c.req.param('id'), tenantId: tenant.id, userId: user.id, input: body.input ?? {}, maxIterations: body.maxIterations }); return c.json({ run }) } catch (e: any) { const code = e?.message === 'UNAUTHORIZED' ? 401 : e?.message === 'AGENT_NOT_FOUND' ? 404 : e?.message === 'INSUFFICIENT_CREDITS' ? 402 : 400; return c.json({ error: e?.message || 'AGENT_RUN_FAILED' }, code) } })
app.post('/agents/:id/stream', async (c) => {
  try {
    const rl = limited(c, `stream:${c.req.param('id')}`, 10)
    if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429)
    const { tenant, user } = await requireUser(c)
    if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404)
    let body: any = {}
    try { body = await c.req.json() } catch {}
    const metered = await openMeteredRun({ agentId: c.req.param('id'), tenantId: tenant.id, userId: user.id, input: body.input ?? {} })
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        try {
          const result = await streamAgent({ agent: metered.agent, tenantId: tenant.id, userId: user.id, input: body.input ?? {}, maxIterations: body.maxIterations, memoryLimit: body.memoryLimit }, send)
          const saved = await metered.complete({ text: result.text, tokensUsed: result.tokensUsed, iterations: result.iterations, trace: result.trace })
          send({ type: 'done_meta', runId: saved?.id, creditsUsed: saved?.creditsUsed })
        } catch (e: any) {
          send({ type: 'error', error: e?.message || 'AGENT_STREAM_FAILED' })
          await metered.fail(e).catch(() => {})
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' } })
  } catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : e?.message === 'AGENT_NOT_FOUND' ? 404 : e?.message === 'INSUFFICIENT_CREDITS' ? 402 : 400
    return c.json({ error: e?.message || 'AGENT_STREAM_FAILED' }, code)
  }
})
app.get('/agents/:id/runs', async (c) => { try { const rl = limited(c, `runs:${c.req.param('id')}`, 60); if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429); const { prisma, tenant } = await requireUser(c); if (!tenant) return c.json({ runs: [] }); const agent = await prisma.agent.findFirst({ where: { id: c.req.param('id'), tenantId: tenant.id }, select: { id: true } }); if (!agent) return c.json({ error: 'AGENT_NOT_FOUND' }, 404); return c.json({ runs: await prisma.agentRun.findMany({ where: { tenantId: tenant.id, agentId: agent.id }, orderBy: { createdAt: 'desc' }, take: 50 }) }) } catch (e: any) { return c.json({ error: e?.message || 'RUN_LIST_FAILED' }, 401) } })
app.get('/agents/:id/memory', async (c) => { try { const { prisma, tenant } = await requireUser(c); const agent = await prisma.agent.findFirst({ where: { id: c.req.param('id'), tenantId: tenant.id } }); if (!agent) return c.json({ error: 'AGENT_NOT_FOUND' }, 404); const q = c.req.query('q') || ''; return c.json({ memories: q ? await retrieveMemory(agent.id, tenant.id, q) : await searchMemory(tenant.id, agent.id, q) }) } catch (e: any) { return c.json({ error: e?.message || 'MEMORY_SEARCH_FAILED' }, 400) } })
app.post('/agents/:id/memory', async (c) => { try { const { prisma, tenant } = await requireUser(c); const agent = await prisma.agent.findFirst({ where: { id: c.req.param('id'), tenantId: tenant.id } }); if (!agent) return c.json({ error: 'AGENT_NOT_FOUND' }, 404); const body: any = await c.req.json(); const content = String(body.content || '').trim(); if (!content) return c.json({ error: 'INVALID_MEMORY' }, 400); const memory = await saveMemory(agent.id, tenant.id, content, body.metadata || {}); return c.json({ memory }, 201) } catch (e: any) { return c.json({ error: e?.message || 'MEMORY_WRITE_FAILED' }, 400) } })
app.get('/tools', async (c) => { const rl = limited(c, 'tools-list', 120); if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429); return c.json({ tools: listTools() }) })
app.post('/tools/:name/execute', async (c) => { try { const rl = limited(c, `tool:${c.req.param('name')}`, 30); if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429); const { prisma, user, tenant } = await requireUser(c); if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404); const tool = getTool(c.req.param('name')); if (!tool) return c.json({ error: 'TOOL_NOT_FOUND' }, 404); const agentId = c.req.header('x-agent-id') || ''; if (!agentId) return c.json({ error: 'AGENT_CONTEXT_REQUIRED' }, 400); const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId: tenant.id } }); if (!agent) return c.json({ error: 'AGENT_NOT_FOUND' }, 404); const allowedTools = new Set((Array.isArray(agent.tools) ? agent.tools : []).map(String)); if (!allowedTools.has(tool.name)) return c.json({ error: 'TOOL_NOT_ALLOWED' }, 403); validateToolPermission(agent, tool); let body: any = {}; try { body = await c.req.json() } catch {} const result = await executeTool(tool.name, body.input, { tenantId: tenant.id, userId: user.id }); return c.json({ ok: true, result }) } catch (e: any) { const code = e?.message === 'UNAUTHORIZED' ? 401 : e?.message === 'TOOL_NOT_FOUND' ? 404 : e?.message === 'TOOL_NOT_ALLOWED' ? 403 : 400; return c.json({ error: e?.message || 'TOOL_EXECUTION_FAILED' }, code) } })
app.get('/usage', async (c) => { try { const { tenant } = await requireUser(c); if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404); return c.json(await getUsage(tenant.id)) } catch (e: any) { return c.json({ error: e?.message || 'USAGE_FAILED' }, 401) } })
app.post('/billing/checkout', async (c) => {
  try {
    const rl = limited(c, 'checkout', 10)
    if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429)
    const { prisma, user, tenant } = await requireUser(c)
    if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404)
    let body: any = {}
    try { body = await c.req.json() } catch {}
    const result = await createCheckout(prisma, { tenantId: tenant.id, userId: user.id, amount: body.amount })
    const refreshed = await prisma.tenant.findUnique({ where: { id: tenant.id }, select: { credits: true, plan: true } })
    return c.json({ payment: { id: result.payment.id, status: result.payment.status, amount: result.payment.amount, currency: result.payment.currency, provider: result.payment.provider, refId: result.payment.refId }, credited: result.credited, redirectUrl: result.redirectUrl, tenant: refreshed }, 201)
  } catch (e: any) {
    const code = e?.message === 'PAYMENT_STUB_DISABLED' ? 503 : e?.message === 'PAYMENT_PROVIDER_NOT_IMPLEMENTED' ? 501 : 400
    return c.json({ error: e?.message || 'CHECKOUT_FAILED' }, code)
  }
})
app.get('/billing/payments', async (c) => {
  try {
    const { prisma, tenant } = await requireUser(c)
    if (!tenant) return c.json({ payments: [] })
    const payments = await prisma.payment.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, amount: true, currency: true, status: true, provider: true, refId: true, createdAt: true } })
    return c.json({ payments })
  } catch (e: any) {
    return c.json({ error: e?.message || 'PAYMENT_LIST_FAILED' }, 401)
  }
})
app.post('/api-keys', async (c) => { try { const { prisma, tenant, user } = await requireUser(c); let body: any = {}; try { body = await c.req.json() } catch {} const generated = generateApiKey(); const row = await prisma.apiKey.create({ data: { tenantId: tenant.id, userId: user.id, name: String(body.name || 'API Key'), hash: generated.hash, prefix: generated.raw.slice(0, 12) } }); return c.json({ id: row.id, name: row.name, key: generated.raw, prefix: row.prefix }, 201) } catch (e: any) { return c.json({ error: e?.message || 'API_KEY_CREATE_FAILED' }, 400) } })
app.get('/api-keys', async (c) => { try { const { prisma, tenant } = await requireUser(c); const rows = await prisma.apiKey.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true }, orderBy: { createdAt: 'desc' } }); return c.json({ keys: rows }) } catch (e: any) { return c.json({ error: e?.message || 'API_KEY_LIST_FAILED' }, 401) } })
app.delete('/api-keys/:id', async (c) => { try { const { prisma, tenant } = await requireUser(c); const row = await prisma.apiKey.findFirst({ where: { id: c.req.param('id'), tenantId: tenant.id } }); if (!row) return c.json({ error: 'API_KEY_NOT_FOUND' }, 404); await prisma.apiKey.update({ where: { id: row.id }, data: { revokedAt: new Date() } }); return c.json({ ok: true }) } catch (e: any) { return c.json({ error: e?.message || 'API_KEY_REVOKE_FAILED' }, 404) } })
app.post('/approvals/:id/resolve', async (c) => { try { const { user, tenant } = await requireUser(c); let body: any = {}; try { body = await c.req.json() } catch {} const result = await resolveApproval(tenant.id, user.id, c.req.param('id'), Boolean(body.approved)); return c.json({ approval: result }) } catch (e: any) { return c.json({ error: e?.message || 'APPROVAL_RESOLVE_FAILED' }, 400) } })
app.get('/admin/overview', async (c) => { try { const { prisma, user } = await requireUser(c); if (user.role !== 'ADMIN') return c.json({ error: 'FORBIDDEN' }, 403); const [users, tenants, agents, runs, payments] = await Promise.all([prisma.user.count(), prisma.tenant.count(), prisma.agent.count(), prisma.agentRun.count(), prisma.payment.count()]); return c.json({ users, tenants, agents, runs, payments }) } catch (e: any) { return c.json({ error: e?.message === 'FORBIDDEN' ? 'FORBIDDEN' : e?.message || 'ADMIN_FAILED' }, e?.message === 'FORBIDDEN' ? 403 : 401) } })
app.post('/marketplace/listings', async (c) => {
  try {
    const rl = limited(c, 'publish', 20)
    if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429)
    const { prisma, user, tenant } = await requireUser(c)
    if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404)
    let body: any = {}
    try { body = await c.req.json() } catch {}
    const listing = await publishListing(prisma, { agentId: String(body.agentId || ''), tenantId: tenant.id, userId: user.id, title: body.title, description: body.description, priceCredits: body.priceCredits })
    return c.json({ listing: { id: listing.id, title: listing.title, priceCredits: listing.priceCredits, status: listing.status, salesCount: listing.salesCount } }, 201)
  } catch (e: any) {
    const code = e?.message === 'AGENT_NOT_FOUND' || e?.message === 'LISTING_NOT_FOUND' ? 404 : 400
    return c.json({ error: e?.message || 'PUBLISH_FAILED' }, code)
  }
})
app.get('/marketplace/listings', async (c) => {
  try {
    const rl = limited(c, 'shop', 120)
    if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429)
    const { prisma } = await requireUser(c)
    return c.json({ listings: await listActiveListings(prisma, Number(c.req.query('take'))) })
  } catch (e: any) {
    const code = e?.message === 'UNAUTHORIZED' ? 401 : 400
    return c.json({ error: e?.message || 'LISTINGS_FAILED' }, code)
  }
})
app.get('/marketplace/my-listings', async (c) => {
  try {
    const { prisma, tenant } = await requireUser(c)
    if (!tenant) return c.json({ listings: [] })
    const rows = await prisma.publishedAgent.findMany({ where: { sellerTenantId: tenant.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, agentId: true, title: true, priceCredits: true, status: true, salesCount: true } })
    return c.json({ listings: rows })
  } catch (e: any) {
    return c.json({ error: e?.message || 'MY_LISTINGS_FAILED' }, 401)
  }
})
app.delete('/marketplace/listings/:id', async (c) => {
  try {
    const { prisma, tenant } = await requireUser(c)
    if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404)
    const listing = await delistListing(prisma, { listingId: c.req.param('id'), sellerTenantId: tenant.id })
    return c.json({ listing: { id: listing.id, status: listing.status } })
  } catch (e: any) {
    const code = e?.message === 'LISTING_NOT_FOUND' ? 404 : 400
    return c.json({ error: e?.message || 'DELIST_FAILED' }, code)
  }
})
app.post('/marketplace/listings/:id/buy', async (c) => {
  try {
    const rl = limited(c, `buy:${c.req.param('id')}`, 10)
    if (!rl.allowed) return c.json({ error: 'RATE_LIMITED', retryAfter: rl.retryAfter }, 429)
    const { prisma, user, tenant } = await requireUser(c)
    if (!tenant) return c.json({ error: 'TENANT_NOT_FOUND' }, 404)
    const result = await buyListing(prisma, { listingId: c.req.param('id'), buyerTenantId: tenant.id, buyerUserId: user.id })
    return c.json(result, 201)
  } catch (e: any) {
    const code = e?.message === 'LISTING_NOT_FOUND' ? 404 : e?.message === 'INSUFFICIENT_CREDITS' ? 402 : 400
    return c.json({ error: e?.message || 'PURCHASE_FAILED' }, code)
  }
})
app.get('/marketplace/purchases', async (c) => {
  try {
    const { prisma, tenant } = await requireUser(c)
    if (!tenant) return c.json({ purchases: [] })
    return c.json({ purchases: await listPurchases(prisma, tenant.id) })
  } catch (e: any) {
    return c.json({ error: e?.message || 'PURCHASES_FAILED' }, 401)
  }
})
app.onError((err, c) => { console.error(err); return c.json({ error: 'INTERNAL_ERROR' }) })
export default app
