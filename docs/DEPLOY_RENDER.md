# استقرار API روی Render

## مراحل

1. [dashboard.render.com](https://dashboard.render.com) → New → **Web Service**
2. Connect: `mydsoftware/ai-agent-manager-platform`
3. تنظیمات:

| فیلد | مقدار |
|------|--------|
| Name | `ai-agent-manager-api` |
| Runtime | Node |
| Build Command | `npm install && npx prisma generate --schema prisma/schema.prisma` |
| Start Command | `npm start` |
| Instance | Free |

4. Env:

- DATABASE_URL = Neon
- JWT_SECRET = ≥32 chars
- CORS_ORIGINS = `https://mydsoftware.github.io,https://YOUR.onrender.com`
- NODE_ENV = production

5. Create Web Service → صبر تا Live

6. تست: `https://YOUR.onrender.com/api/health`

7. در GitHub Pages داشبورد:
`API_URL=https://YOUR.onrender.com/api`

## Free plan
سرویس بعد از بیکاری می‌خوابد؛ اولین درخواست ۳۰–۶۰ ثانیه.
