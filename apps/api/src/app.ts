import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono().basePath('/api');
app.use('*', logger());
app.use('*', cors({ origin: '*', credentials: true }));
app.get('/', (c) => c.json({ name: 'AI Agent Manager API', status: 'ok', firstPaymentStatus: false }));
app.get('/health', (c) => c.json({ status: 'ok' }));
app.onError((err, c) => c.json({ error: err.message || 'INTERNAL_ERROR' }, 500));
export default app;
