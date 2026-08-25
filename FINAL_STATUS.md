# FINAL_STATUS

## وضعیت فعلی
- Auth register/login/me: implemented (JWT fail-closed در production، بدون secret پیش‌فرض)
- Admin promotion: فقط از طریق `ADMIN_EMAILS` / `ADMIN_EMAIL` env — ایمیل هاردکد حذف شد
- CORS: explicit allow-list support
- PostgreSQL/Prisma schema: aligned with auth and billing API
- Credits: رزرو اتمیک قبل از اجرای LLM (`reserveCredits`)، تسویه/بازپرداخت بعد از اجرا؛ اعتبار هرگز منفی نمی‌شود
- Streaming metering: `/agents/:id/stream` اکنون AgentRun ذخیره می‌کند و اعتبار کسر می‌کند
- API keys: احراز هویت با هدر `x-api-key` فعال است (تمام روت‌های محافظت‌شده)
- Billing: `POST /billing/checkout` + `GET /billing/payments` با درگاه stub تستی
  - stub فقط خارج production و با `PAYMENT_STUB_AUTO_SUCCESS=true`
  - آداپتور درگاه واقعی (Zarinpal و…) بعد از دریافت دامنه به `PAYMENT_PROVIDER` وصل می‌شود
- Tests: unit tests برای billing/credits + security tests؛ اسکریپت `test:security` اضافه شد (CI سبز)

## باقی‌مانده برای درآمد واقعی
1. Configure `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` در محیط production.
2. خرید دامنه → دریافت درگاه پرداخت واقعی → پیاده‌سازی adapter با redirect/callback verification.
3. یکسان‌سازی دو Prisma schema (ریشه و packages/db) — فعلاً Vercel و Render از دو فایل متفاوت استفاده می‌کنند.
4. Rate limit توزیع‌شده (Redis) برای serverless.
5. پاک‌سازی پکیج‌های استاب مونوریپو یا تکمیل آنها.

## مهم
`PAYMENT_STUB_AUTO_SUCCESS=true` فقط development است و وقتی `NODE_ENV=production` باشد سخت رد می‌شود.

Repo: https://github.com/mydsoftware/ai-agent-manager-platform
