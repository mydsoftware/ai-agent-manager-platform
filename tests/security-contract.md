# Security Isolation Contract

این قرارداد تستی برای جلوگیری از Regression در امنیت Tenant/Agent است.

## Required invariants

- کاربر فقط Agentهای Tenant خودش را می‌تواند اجرا/مشاهده کند.
- Memory خواندن/نوشتن فقط برای Agent متعلق به Tenant کاربر مجاز است.
- Run history فقط برای Agent متعلق به Tenant کاربر مجاز است.
- Admin endpoints فقط برای `role=ADMIN` مجاز هستند.
- Tool execution باید احراز هویت، Tenant context و Agent authorization داشته باشد.
- API keys فقط در Tenant مالک قابل مشاهده/لغو هستند.
- Approval resolution باید Tenant و User مجاز را بررسی کند.
- Stream endpoint باید rate-limited باشد.

## Negative test matrix

| Scenario | Expected |
|---|---|
| User A → Agent B | 404/403 |
| User A → Memory B | 404/403 |
| User A → Runs B | 404/403 |
| User A → API key B | 404/403 |
| User A → Admin overview | 403 |
| User A → Tool of Agent B | 403/404 |
| Anonymous → protected API | 401 |
| Stream over limit | 429 |

این فایل عمداً یک قرارداد مستقل است تا تست‌های اجرایی بعدی دقیقاً همین invariants را enforce کنند.