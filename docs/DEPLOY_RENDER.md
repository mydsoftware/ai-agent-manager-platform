# استقرار API روی Render

## معماری

```
GitHub Pages (UI)
      ↓
Render Web Service (API Node)
      ↓
Neon PostgreSQL
```

## مراحل

1. [dashboard.render.com](https://dashboard.render.com) → New → Web Service
2. Connect: `mydsoftware/ai-agent-manager-platform`
3. Build: `npm install && npx prisma generate --schema prisma/schema.prisma`
4. Start: `npm start`
5. Plan: Free

## Env

- DATABASE_URL = Neon connection string
- JWT_SECRET = random ≥32 chars
- CORS_ORIGINS = `https://mydsoftware.github.io,https://YOUR-SERVICE.onrender.com`
- NODE_ENV = production

## بعد از Deploy

Health: `https://YOUR-SERVICE.onrender.com/api/health`

در GitHub Pages داشبورد:
`API_URL=https://YOUR-SERVICE.onrender.com/api`

Free plan بعد از بیکاری می‌خوابد؛ اولین درخواست ممکن است کند باشد.
