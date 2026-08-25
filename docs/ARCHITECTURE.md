# معماری AI Agent Manager Platform

## نمای کلی

- Frontend استاتیک (`public/`) — GitHub Pages / CDN
- API (`api/`) — Hono، مستقل از Vercel
- PostgreSQL + Prisma 5.22
- Tenant isolation روی همه queryها

## واقعی vs Stub

| بخش | وضعیت |
|-----|--------|
| Auth JWT/bcrypt | واقعی |
| Agents / Runs | واقعی |
| Tools / Policy | واقعی |
| Memory / RAG | واقعی + keyword fallback |
| Approvals / API Keys | واقعی |
| Payment gateway | stub |

## امنیت

JWT secret ≥32، bcrypt 12، tenant filter، ADMIN role، CORS از env، بدون secret در Git.
