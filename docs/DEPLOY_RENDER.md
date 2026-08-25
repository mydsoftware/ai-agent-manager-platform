# استقرار API روی Render

## معماری

```
GitHub Pages (UI)
      ↓
Render Web Service (API)
      ↓
Neon PostgreSQL
```

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

- `DATABASE_URL` = Neon connection string
- `JWT_SECRET` = random ≥32 chars
- `CORS_ORIGINS` = `https://mydsoftware.github.io,https://YOUR-SERVICE.onrender.com`
- `NODE_ENV` = `production`

5. Create Web Service و صبر تا Deploy سبز شود

6. تست:
```
https://YOUR-SERVICE.onrender.com/api/health
```
باید `"database":"connected"` باشد.

7. در GitHub Pages داشبورد:
```
API_URL=https://YOUR-SERVICE.onrender.com/api
```

## نکته Free plan
سرویس بعد از بیکاری می‌خوابد؛ اولین درخواست ممکن است ۳۰–۶۰ ثانیه طول بکشد.
