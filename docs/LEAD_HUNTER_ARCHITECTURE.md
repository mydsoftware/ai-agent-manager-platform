# معماری فنی AI Lead Hunter

## جایگاه در پلتفرم
این قابلیت به‌صورت ماژول مستقل در `ai-agent-manager-platform` توسعه می‌یابد و از احراز هویت، Tenant، Agent Runtime، سیاست ابزارها، metering و audit موجود استفاده می‌کند. پروژه amlak-divar در آینده می‌تواند به‌عنوان یک منبع/کانکتور تخصصی و vertical pack متصل شود؛ منطق عمومی CRM در آن کپی نمی‌شود.

## اجزای پیشنهادی
- API: Hono routes در `api/leads/` یا ماژول‌های هم‌سطح.
- Domain: مدل‌های مستقل برای BusinessProfile، ICP، Lead، LeadEvidence، ConsentRecord، SuppressionEntry، Conversation، Campaign، ConnectorAccount، Activity و Task.
- Persistence: PostgreSQL/Prisma؛ تمام queryها با tenantId محدود شوند.
- Queue: در MVP پردازش هم‌زمان/پس‌زمینه سبک؛ در مقیاس، صف پایدار با retry، idempotency و dead-letter.
- AI: ارائه‌دهنده سازگار با OpenAI/OpenRouter از لایه LLM موجود؛ خروجی ساخت‌یافته Zod؛ promptها tenant-scoped و versioned.
- Connectors: قرارداد مشترک Capability-based؛ كلیدها رمزگذاری‌شده و هر کانکتور دارای health/status و scopes.
- UI: داشبورد RTL فارسی، قابلیت تغییر زبان بعداً؛ نمایش وضعیت مجوز و consent.
- Observability: structured logs، correlationId، audit events، metrics و هزینه هر اجرای AI.

## قرارداد کانکتور
هر کانکتور باید این قابلیت‌ها را به‌صورت مستقل اعلام کند:
- authenticate / refresh / revoke
- ingest (webhook یا polling مجاز)
- sendMessage (فقط در صورت پشتیبانی رسمی و مجاز)
- getCapabilities / healthCheck
- normalizeIncoming / normalizeDelivery
- rateLimit policy، retry policy و idempotency
- optOut handling و suppression sync

کانکتور نباید scraping مرورگر، شبیه‌سازی رفتار کاربر یا دور زدن محدودیت پلتفرم را به‌عنوان مسیر پیش‌فرض پیاده کند.

## ماتریس کانال‌ها
| کانال | مسیر ادغام اولیه | وضعیت پیش‌فرض |
|---|---|---|
| دیوار | فرم/ورودی دستی، لینک و منابعی که مجوز/رابط رسمی معتبر دارند | ارسال خودکار تا زمان تأیید API/مجوز غیرفعال |
| شیپور | ورودی دستی/CSV و رابط مجاز در صورت ارائه | ارسال خودکار غیرفعال |
| تلگرام | Telegram Bot API برای تعامل با کاربران/گروه‌هایی که ربات به آن‌ها دسترسی مجاز دارد | فعال پس از اتصال مالک و رضایت کاربر |
| روبیکا | API/ربات رسمی و مستندات جاری | تا تأیید قابلیت‌ها غیرفعال |
| واتساپ | WhatsApp Business Platform / Cloud API و قالب‌های تأییدشده | فقط مخاطبان و opt-in معتبر |
| ایتا | API/ربات رسمی و مستندات جاری | تا تأیید قابلیت‌ها غیرفعال |
| اینستاگرام | Instagram Messaging API در محدوده حساب حرفه‌ای و پنجره/سیاست پیام‌رسانی متا | فقط قابلیت‌های مجاز API |

وجود نام یک کانال در این ماتریس به معنی تضمین API عمومی یا امکان ارسال پیام سرد نیست. هر connector با شواهد مستند، آزمون اتصال و تأیید مدیر فعال می‌شود.

## مدل امنیت و حریم خصوصی
- tenantId از نشست احراز هویت استخراج می‌شود، نه از body درخواست.
- secrets در متن ساده یا log ذخیره نمی‌شوند.
- RBAC: owner/admin/manager/agent/viewer.
- رمزگذاری داده‌های حساس در حالت سکون و انتقال.
- audit log غیرقابل‌ویرایش برای رویدادهای حساس.
- rate limit per tenant + per connector + per recipient.
- allowlist/denylist، سقف پیام روزانه، quiet hours و kill switch.
- حذف داده و retention policy قابل تنظیم.
- محتوای ورودی کانال‌ها untrusted است؛ prompt injection باید خنثی شود.

## جریان پردازش سرنخ
1. دریافت ورودی و ثبت منبع/زمان.
2. نرمال‌سازی و deduplication با شناسه منبع/کلید هش.
3. ثبت evidence و provenance.
4. بررسی suppression و مبنای پردازش/ارتباط.
5. امتیازدهی قطعی اولیه.
6. تحلیل AI با خروجی ساخت‌یافته و confidence.
7. ورود به صف بازبینی یا pipeline.
8. پیشنهاد پیام؛ ارسال تنها پس از policy check و مجوز.
9. ثبت نتیجه delivery و رویدادهای بعدی.

## سیاست ارسال
`sendMessage` باید قبل از ارسال تمام شروط زیر را پاس کند: connector فعال، مجوز معتبر، recipient در محدوده مجاز، consent/legal basis ثبت‌شده، نبودن در suppression list، رعایت پنجره زمانی و rate limit، template/purpose معتبر و approval policy. در غیر این صورت ارسال رد می‌شود و علت ثبت خواهد شد.

## آزمون‌های ضروری
- tenant isolation و IDOR
- consent missing / revoked / expired
- suppression list و opt-out
- rate limit و duplicate webhook
- retry idempotency
- malformed/untrusted provider payload
- prompt injection در پیام ورودی
- حذف و export داده
- connector capability mismatch
