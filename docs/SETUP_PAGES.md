# راه‌اندازی GitHub Pages (Frontend)

## معماری

```
مرورگر
  → GitHub Pages (HTML/JS استاتیک — بدون Secret)
  → HTTPS API (Vercel / Railway / Fly / …)
  → PostgreSQL (Neon)
```

GitHub Pages **سرور Node یا دیتابیس اجرا نمی‌کند.** فقط UI را سرو می‌کند.

## فعال‌سازی (یک‌بار)

1. برو به:  
   https://github.com/mydsoftware/ai-agent-manager-platform/settings/pages
2. **Source** را بگذار روی **GitHub Actions**
3. از تب **Actions** workflow به نام **Deploy GitHub Pages** را اگر Fail بود، **Re-run** کن  
   (یا یک push به `main` بزن تا دوباره اجرا شود)
4. آدرس سایت:

```
https://mydsoftware.github.io/ai-agent-manager-platform/
```

داشبورد:

```
https://mydsoftware.github.io/ai-agent-manager-platform/dashboard.html
```

## تنظیم API

پیش‌فرض در `docs/config.js`:

```
https://ai-agent-manager-platform-five.vercel.app/api
```

در داشبورد می‌توانی `API_URL` را عوض کنی و **ذخیره** بزنی.

## CORS روی API (Vercel)

```
CORS_ORIGINS=https://mydsoftware.github.io,https://ai-agent-manager-platform-five.vercel.app
```

بعد Redeploy بک‌اند.

## امنیت

داخل `docs/` هرگز `DATABASE_URL` یا `JWT_SECRET` نگذار.
