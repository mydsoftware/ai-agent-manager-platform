import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const g = globalThis as unknown as { prisma?: PrismaClient }
export const pageDb: PrismaClient = g.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') g.prisma = pageDb

export const MAX_PAGE_HTML_LENGTH = 300_000

const BALANCED_TAGS = ['html', 'head', 'body', 'div', 'section', 'main', 'header', 'footer', 'nav', 'article', 'aside', 'table', 'form', 'ul', 'ol', 'script', 'style', 'title', 'h1', 'h2', 'h3', 'button', 'select', 'textarea'] as const

export type HtmlCheckResult = { valid: boolean; issues: string[]; warnings: string[] }

export function extractHtml(output: string): string | null {
  const text = String(output || '')
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fenced && /<html|<!doctype/i.test(fenced[1])) return fenced[1].trim()
  const lower = text.toLowerCase()
  const start = lower.indexOf('<!doctype html') >= 0 ? lower.indexOf('<!doctype html') : text.search(/<html[\s>]/i)
  const end = text.toLowerCase().lastIndexOf('</html>')
  if (start >= 0 && end > start) return text.slice(start, end + '</html>'.length).trim()
  return null
}

export function titleFromHtml(html: string): string {
  const match = String(html || '').match(/<title[^>]*>([^<]*)<\/title>/i)
  return (match?.[1] || 'صفحه بدون عنوان').trim().slice(0, 120)
}

export function validateHtml(html: string): HtmlCheckResult {
  const source = String(html || '')
  const issues: string[] = []
  const warnings: string[] = []
  if (!source.trim()) return { valid: false, issues: ['محتوای HTML خالی است'], warnings }

  if (!/<!doctype\s+html/i.test(source)) issues.push('DOCTYPE وجود ندارد')
  if (!/<html[\s>]/i.test(source)) issues.push('تگ <html> وجود ندارد')
  if (!/<head[\s>]/i.test(source)) issues.push('تگ <head> وجود ندارد')
  if (!/<body[\s>]/i.test(source)) issues.push('تگ <body> وجود ندارد')
  if (!/<title[^>]*>[^<]*<\/title>/i.test(source)) issues.push('تگ <title> خالی یا ناموجود است')

  for (const tag of BALANCED_TAGS) {
    const open = (source.match(new RegExp(`<${tag}(\\s|>)`, 'gi')) || []).length
    const close = (source.match(new RegExp(`</${tag}>`, 'gi')) || []).length
    if (open !== close) issues.push(`تگ <${tag}> بسته نشده (${open} باز، ${close} بسته)`)
  }
  if (!/<meta[^>]+viewport/i.test(source)) warnings.push('متا تگ viewport برای موبایل وجود ندارد')
  const imgsNoAlt = (source.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length
  if (imgsNoAlt > 0) warnings.push(`${imgsNoAlt} تصویر بدون alt`)
  if (source.length > MAX_PAGE_HTML_LENGTH) issues.push('حجم صفحه بیش از حد مجاز است')

  return { valid: issues.length === 0, issues, warnings }
}

export function newPageSlug(): string {
  return randomBytes(6).toString('hex')
}

type PagePrisma = Pick<PrismaClient, 'generatedPage'>

export async function saveGeneratedPage(db: PagePrisma, tenantId: string, input: { html: unknown }) {
  const html = typeof input?.html === 'string' ? input.html.trim() : ''
  if (!html) throw new Error('EMPTY_HTML')
  if (html.length > MAX_PAGE_HTML_LENGTH) throw new Error('HTML_TOO_LARGE')
  const check = validateHtml(html)
  const slug = newPageSlug()
  const page = await db.generatedPage.create({
    data: { tenantId, slug, title: titleFromHtml(html), html },
    select: { id: true, slug: true, title: true, createdAt: true },
  })
  return { page, check, url: `/api/pages/${slug}` }
}

export async function getPageBySlug(db: PagePrisma, slug: string) {
  if (!/^[a-z0-9]{6,32}$/.test(slug)) return null
  return db.generatedPage.findUnique({ where: { slug }, select: { html: true } })
}

export async function listTenantPages(db: PagePrisma, tenantId: string, limit = 50) {
  const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 100)
  return db.generatedPage.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, slug: true, title: true, createdAt: true },
  })
}
