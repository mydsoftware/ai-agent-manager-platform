# FINAL_STATUS

## وضعیت فعلی
- **مدیریت ایجنت (Orchestrator): فعال** — `POST /orchestrator/request` (+ نسخه SSE `/stream`)
  1. مشتری درخواست فارسی می‌دهد (مثلاً «سایت در زمینه ماهواره مرکزی»)
  2. سیستم بین متخصص‌های موجود جستجو می‌کند (امتیاز تطبیق کلیدواژه/تخصص)
  3. اگر متخصص موجود باشد از همان استفاده می‌شود؛ نبود، LLM مشخصات متخصص جدید را تولید و ثبت می‌کند
  4. حلقه ReAct اجرا می‌شود (ابزارمحور، حافظه‌دار)
  5. کنترل کیفیت (LLM-as-Judge) خروجی را می‌سنجد؛ نقص‌ها به چرخه بعدی بازخورد داده می‌شوند تا pass یا سقف چرخه
- متخصص‌های پایه (auto-seed برای هر tenant): سئو · سایت‌ساز · وردپرس · برنامه‌نویس — `GET /specialists`
- ستون‌های جدید Agent: `specialty`, `keywords`, `origin` (`SEED` | `AUTO_GENERATED` | `MANUAL`)
- داشبورد: کارت «مدیریت ایجنت» با نمایش زنده جستجو/ساخت/چرخه/کیفیت + بخش «متخصص‌های من»
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
- Tests: ۲۹ تست واحد (orchestrator, billing, credits, security) — همه سبز
- Tests: unit tests برای billing/credits + security tests؛ اسکریپت `test:security` اضافه شد (CI سبز)

## باقی‌مانده برای درآمد واقعی
1. Configure `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` در محیط production.
2. خرید دامنه → دریافت درگاه پرداخت واقعی → پیاده‌سازی adapter با redirect/callback verification.
3. Rate limit توزیع‌شده (Redis) برای serverless.
4. وریفایکیشن ایمیل + بازیابی رمز عبور.
5. ابزارهای عملیاتی برای متخصص‌ها: اجرای کد/پیش‌نمایش سایت، انتشار وردپرس، آنالیز سئو واقعی (فعلاً فقط web_search).

## مهم
`PAYMENT_STUB_AUTO_SUCCESS=true` فقط development است و وقتی `NODE_ENV=production` باشد سخت رد می‌شود.

Repo: https://github.com/mydsoftware/ai-agent-manager-platform
