# استقرار روی Vercel

## GitHub vs Vercel
- GitHub = فقط کد
- Vercel = وب + API زنده

## دیتابیس
روی Vercel از Neon/Supabase Postgres استفاده کن (نه SQLite فایل).

## مراحل
1. vercel.com/new → Import `mydsoftware/ai-agent-manager-platform`
2. Output: `public`
3. Env: DATABASE_URL, JWT_SECRET, CORS_ORIGINS
4. Deploy
5. از لوکال migrate با همان DATABASE_URL

سایت: https://YOUR.vercel.app
API: https://YOUR.vercel.app/api
