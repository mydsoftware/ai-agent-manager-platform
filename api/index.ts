import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono().basePath('/api')

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
    version: '0.1.0',
    status: 'ok',
    firstPaymentStatus: false,
    runtime: 'vercel',
  })
)

app.get('/health', (c) =>
  c.json({ status: 'ok', time: new Date().toISOString() })
)

app.get('/auth/status', (c) =>
  c.json({ authenticated: false, message: 'Auth needs DATABASE_URL + migrate' })
)

app.post('/auth/register', (c) =>
  c.json({ error: 'NOT_CONFIGURED', message: 'Connect Neon DB and run migrate' }, 503)
)

app.post('/auth/login', (c) =>
  c.json({ error: 'NOT_CONFIGURED', message: 'Connect Neon DB and run migrate' }, 503)
)

app.post('/billing/checkout', (c) =>
  c.json({ error: 'NOT_CONFIGURED', message: 'Payment needs DATABASE_URL', firstPaymentStatus: false }, 503)
)

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message || 'INTERNAL_ERROR' }, 500)
})

export default app
