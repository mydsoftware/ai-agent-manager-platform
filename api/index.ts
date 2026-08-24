import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const app = new Hono().basePath('/api')

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
function db() {
  if (!process.env.DATABASE_URL) return null
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient()
  }
  return globalForPrisma.prisma
}

function jwtSecret() {
  const s = process.env.JWT_SECRET || 'dev-change-me-in-production-32chars!!'
  return new TextEncoder().encode(s)
}

async function signToken(payload: { sub: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtSecret())
}

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, jwtSecret())
  return payload as { sub: string; email: string }
}

app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim())
      if (allowed.includes('*') || !origin) return origin || '*'
      return allowed.includes(origin) ? origin : allowed[0]
    },
    credentials: true,
  })
)

app.get('/', (c) =>
  c.json({
    name: 'AI Agent Manager API',
    version: '0.2.0',
    status: 'ok',
    firstPaymentStatus: false,
    runtime: 'vercel',
    dbConfigured: Boolean(process.env.DATABASE_URL),
  })
)

app.get('/health', async (c) => {
  const prisma = db()
  let dbOk = false
  let dbError: string | null = null
  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch (e: any) {
      dbError = e?.message || 'db_error'
    }
  }
  return c.json({
    status: dbOk ? 'ok' : process.env.DATABASE_URL ? 'degraded' : 'ok',
    time: new Date().toISOString(),
    database: dbOk ? 'connected' : process.env.DATABASE_URL ? 'error' : 'not_configured',
    dbError,
  })
})

app.post('/auth/register', async (c) => {
  const prisma = db()
  if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'INVALID_JSON' }, 400)
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const name = body.name ? String(body.name).trim() : null

  if (!email || !password || password.length < 6) {
    return c.json({ error: 'INVALID_INPUT', message: 'email and password (min 6) required' }, 400)
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return c.json({ error: 'EMAIL_ALREADY_EXISTS' }, 409)

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        tenants: {
          create: {
            name: name || email.split('@')[0],
            slug: `t-${Date.now().toString(36)}`,
            plan: 'FREE',
            credits: 100,
          },
        },
      },
      include: { tenants: true },
    })

    const token = await signToken({ sub: user.id, email: user.email })
    return c.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      tenant: user.tenants[0]
        ? { id: user.tenants[0].id, name: user.tenants[0].name, credits: user.tenants[0].credits, plan: user.tenants[0].plan }
        : null,
    })
  } catch (e: any) {
    console.error(e)
    return c.json({ error: 'REGISTER_FAILED', message: e?.message || 'failed' }, 500)
  }
})

app.post('/auth/login', async (c) => {
  const prisma = db()
  if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'INVALID_JSON' }, 400)
  }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) return c.json({ error: 'INVALID_INPUT' }, 400)

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenants: true },
    })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return c.json({ error: 'INVALID_CREDENTIALS' }, 401)
    }

    const token = await signToken({ sub: user.id, email: user.email })
    return c.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      tenant: user.tenants[0]
        ? { id: user.tenants[0].id, name: user.tenants[0].name, credits: user.tenants[0].credits, plan: user.tenants[0].plan }
        : null,
    })
  } catch (e: any) {
    console.error(e)
    return c.json({ error: 'LOGIN_FAILED', message: e?.message || 'failed' }, 500)
  }
})

app.get('/auth/me', async (c) => {
  const prisma = db()
  if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503)

  const auth = c.req.header('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return c.json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const payload = await verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenants: true },
    })
    if (!user) return c.json({ error: 'UNAUTHORIZED' }, 401)
    return c.json({
      user: { id: user.id, email: user.email, name: user.name },
      tenant: user.tenants[0]
        ? { id: user.tenants[0].id, name: user.tenants[0].name, credits: user.tenants[0].credits, plan: user.tenants[0].plan }
        : null,
    })
  } catch {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }
})

app.post('/billing/checkout', async (c) => {
  const prisma = db()
  if (!prisma) return c.json({ error: 'DATABASE_NOT_CONFIGURED' }, 503)

  const auth = c.req.header('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return c.json({ error: 'UNAUTHORIZED' }, 401)

  try {
    const payload = await verifyToken(token)
    let body: any = {}
    try {
      body = await c.req.json()
    } catch {}

    const amount = Number(body.amount || 100000)
    const payment = await prisma.payment.create({
      data: {
        userId: payload.sub,
        amount,
        currency: 'IRR',
        status: 'PENDING',
        provider: process.env.PAYMENT_PROVIDER || 'stub',
      },
    })

    if (process.env.PAYMENT_STUB_AUTO_SUCCESS === 'true') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', refId: `stub_${Date.now()}` },
      })
      const tenant = await prisma.tenant.findFirst({ where: { ownerId: payload.sub } })
      if (tenant) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { credits: { increment: 500 }, plan: tenant.plan === 'FREE' ? 'STARTER' : tenant.plan },
        })
      }
      return c.json({
        paymentId: payment.id,
        status: 'SUCCESS',
        firstPaymentStatus: true,
        message: 'Stub payment succeeded',
      })
    }

    return c.json({
      paymentId: payment.id,
      status: 'PENDING',
      firstPaymentStatus: false,
      message: 'Real gateway not connected. For test set PAYMENT_STUB_AUTO_SUCCESS=true',
      checkoutUrl: null,
    })
  } catch (e: any) {
    return c.json({ error: 'CHECKOUT_FAILED', message: e?.message }, 500)
  }
})

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message || 'INTERNAL_ERROR' }, 500)
})

export default app
