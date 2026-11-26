# نقشه راه اجرایی AI Lead Hunter

## فاز صفر — پایه محصول
- [x] تعیین دامنه عمومی و هفت کانال هدف
- [x] انتخاب پلتفرم پایه چندمستاجری
- [x] تعریف مرزهای حقوقی/فنی کانکتورها
- [x] تعریف مدل محصول و معماری اولیه
- [ ] بازبینی دقیق schema و migration strategy
- [ ] تثبیت قرارداد API و تست‌های امنیتی

## فاز یک — هسته MVP
- [ ] BusinessProfile و ICP
- [ ] Lead و LeadEvidence و ConsentRecord
- [ ] SuppressionEntry و Activity
- [ ] API CRUD با tenant isolation
- [ ] CSV import/export و deduplication
- [ ] scoring قطعی قابل توضیح
- [ ] تست‌های واحد و امنیتی

## فاز دو — هوش مصنوعی
- [ ] طبقه‌بندی نیاز و استخراج فیلدها
- [ ] خلاصه‌سازی مکالمه
- [ ] پیشنهاد پاسخ مبتنی بر دانش کسب‌وکار
- [ ] توضیح امتیاز و confidence
- [ ] human-in-the-loop و هزینه‌سنجی

## فاز سه — کانکتورها
- [ ] قرارداد عمومی connector و capability registry
- [ ] Telegram Bot API
- [ ] WhatsApp Business Platform
- [ ] Instagram Messaging API
- [ ] بررسی مستندات رسمی و امکان‌پذیری روبیکا و ایتا
- [ ] بررسی دسترسی و مجوزهای دیوار و شیپور
- [ ] webhook security، retry و idempotency

## فاز چهار — CRM و کمپین
- [ ] pipeline قابل تنظیم
- [ ] task/reminder
- [ ] campaign و approval workflow
- [ ] frequency cap، quiet hours و opt-out
- [ ] گزارش تبدیل و A/B testing

## فاز پنج — آماده‌سازی تولید
- [ ] بارگذاری امن secrets
- [ ] observability و alerting
- [ ] تست بار و بازیابی
- [ ] retention و حذف داده
- [ ] مستندات نصب، backup و ارتقا

## معیار خروج هر فاز
هر فاز تنها پس از typecheck، تست‌های واحد، تست tenant isolation، بررسی امنیت و ثبت وضعیت واقعی در این فایل کامل تلقی می‌شود. هیچ اتصال کانالی بدون آزمایش واقعی و مستندات رسمی «تکمیل‌شده» اعلام نمی‌شود.
