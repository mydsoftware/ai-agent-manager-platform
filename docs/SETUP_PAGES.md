# راه‌اندازی GitHub Pages

## معماری

GitHub Pages = فقط Frontend استاتیک
API = Vercel / Railway / هر host
Database = Neon Postgres

هیچ Secret داخل Pages نیست.

## فعال‌سازی

1. Settings → Pages → Source: **GitHub Actions**
2. بعد از push، workflow Deploy GitHub Pages اجرا می‌شود
3. آدرس: `https://mydsoftware.github.io/ai-agent-manager-platform/`

## API_URL

پیش‌فرض در config.js به Vercel اشاره می‌کند.
در داشبورد قابل تغییر و ذخیره در localStorage است.

## CORS در Vercel

```
CORS_ORIGINS=https://mydsoftware.github.io
```
