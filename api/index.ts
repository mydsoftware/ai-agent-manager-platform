import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const app = new Hono().basePath('/api')
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
function db() {
  if (!process.env.DATABASE_URL) return null
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient()
  return globalForPrisma.prisma
}
function jwtSecret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return new TextEncoder().encode(value)
}
async function signToken(payload: { sub: string; email: string }) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(jwtSecret())
}
async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, jwtSecret())
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('invalid_token')
  return payload as { sub: string; email: string }
}
function authToken(c: any) {
  const value = c.req.header('authorization') || ''
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}
const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
app.use('*', cors({ origin: (origin) => { if (!origin) return configuredOrigins[0] || ''; if (configuredOrigins.includes(origin)) return origin; return '' }, credentials: true }))
app.get('/', (c) => c.json({ name: 'AI Agent Manager API', version: '0.2.2', status: 'ok', firstPaymentStatus: false, runtime: 'vercel', dbConfigured: Boolean(process.env.DATABASE_URL), authConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32), paymentConfigured: Boolean(process.env.PAYMENT_PROVIDER) }))
app.get('/health', async (c) => {
  const prisma = db(); let dbOk = false; let dbError: string | null = null
  if (prisma) { try { await prisma.$queryRaw`SELECT 1`; dbOk = true } catch (e: any) { dbError = e?.message || 'db_error' } }
  return c.json({ status: dbOk ? 'ok' : process.env.DATABASE_URL ? 'degraded' : 'ok', time: new Date().toISOString(), database: dbOk ? 'connected' : process.env.DATABASE_URL ? 'error' : 'not_configured', dbError })
})
app.post('/auth/register', async (c) => {
  const prisma = db(); if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503)
  let body: any; try { body = await c.req.json() } catch { return c.json({ error: 'INVALID_JSON' }, 400) }
  const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || ''); const name = body.name ? String(body.name).trim().slice(0, 120) : null
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6 || password.length > 128) return c.json({ error: 'INVALID_INPUT', message: 'valid email and password (6-128) required' }, 400)
  try {
    const existing = await prisma.user.findUnique({ where: { email } }); if (existing) return c.json({ error: 'EMAIL_ALREADY_EXISTS' }, 409)
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({ data: { email, passwordHash, name, ownedTenants: { create: { name: name || email.split('@')[0], slug: `t-${Date.now().toString(36)}`, plan: 'FREE', credits: 100 } } }, include: { ownedTenants: true } })
    const token = await signToken({ sub: user.id, email: user.email }); const tenant = user.ownedTenants[0]
    return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role }, tenant: tenant ? { id: tenant.id, name: tenant.name, credits: tenant.credits, plan: tenant.plan } : null })
  } catch (e: any) { console.error(e); return c.json({ error: 'REGISTER_FAILED' }, 500) }
})
app.post('/auth/login', async (c) => {
  const prisma = db(); if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503)
  let body: any; try { body = await c.req.json() } catch { return c.json({ error: 'INVALID_JSON' }, 400) }
  const email = String(body.email || '').trim().toLowerCase(); const password = String(body.password || '')
  if (!email || !password) return c.json({ error: 'INVALID_INPUT' }, 400)
  try {
    const user = await prisma.user.findUnique({ where: { email }, include: { ownedTenants: true } })
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return c.json({ error: 'INVALID_CREDENTIALS' }, 401)
    const token = await signToken({ sub: user.id, email: user.email }); const tenant = user.ownedTenants[0]
    return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role }, tenant: tenant ? { id: tenant.id, name: tenant.name, credits: tenant.credits, plan: tenant.plan } : null })
  } catch (e: any) { console.error(e); return c.json({ error: 'LOGIN_FAILED' }, 500) }
})
app.get('/auth/me', async (c) => {
  const prisma = db(); if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503)
  const token = authToken(c); if (!token) return c.json({ error: 'UNAUTHORIZED' }, 401)
  try {
    const payload = await verifyToken(token); const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { ownedTenants: true } })
    if (!user || !user.isActive) return c.json({ error: 'UNAUTHORIZED' }, 401)
    const tenant = user.ownedTenants[0]
    return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, isAdmin: user.role === 'ADMIN' }, tenant: tenant ? { id: tenant.id, name: tenant.name, credits: tenant.credits, plan: tenant.plan } : null })
  } catch { return c.json({ error: 'UNAUTHORIZED' }, 401) }
})
app.post('/billing/checkout', async (c) => {
  const prisma = db(); if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503)
  const token = authToken(c); if (!token) return c.json({ error: 'UNAUTHORIZED' }, 401)
  let payload: { sub: string; email: string }; try { payload = await verifyToken(token) } catch { return c.json({ error: 'UNAUTHORIZED' }, 401) }
  let body: any = {}; try { body = await c.req.json() } catch {}
  const amount = Number(body.amount); if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 100_000_000) return c.json({ error: 'INVALID_AMOUNT' }, 400)
  const provider = process.env.PAYMENT_PROVIDER; if (!provider) return c.json({ error: 'PAYMENT_PROVIDER_NOT_CONFIGURED', message: 'Connect a real gateway before accepting payments.' }, 503)
  try {
    const payment = await prisma.payment.create({ data: { userId: payload.sub, amount, currency: 'IRR', status: 'PENDING', provider } })
    if (process.env.PAYMENT_STUB_AUTO_SUCCESS === 'true' && process.env.NODE_ENV !== 'production') {
      const tenant = await prisma.tenant.findFirst({ where: { ownerId: payload.sub } })
      await prisma.$transaction(async (tx) => { await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS', refId: `stub_${Date.now()}` } }); if (tenant) await tx.tenant.update({ where: { id: tenant.id }, data: { credits: { increment: 500 }, plan: tenant.plan === 'FREE' ? 'STARTER' : tenant.plan } }) })
      return c.json({ paymentId: payment.id, status: 'SUCCESS', firstPaymentStatus: true, message: 'Development stub payment succeeded' })
    }
    return c.json({ paymentId: payment.id, status: 'PENDING', firstPaymentStatus: false, message: 'Payment created; gateway adapter must complete the redirect/callback flow.', checkoutUrl: null }, 202)
  } catch (e: any) { console.error(e); return c.json({ error: 'CHECKOUT_FAILED' }, 500) }
})
app.onError((err, c) => { console.error(err); return c.json({ error: 'INTERNAL_ERROR' }) })
export default app
