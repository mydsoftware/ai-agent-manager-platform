import { describe, expect, it } from 'vitest'
import { extractHtml, titleFromHtml, validateHtml } from '../api/pages'

const goodPage = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>سایت ماهواره مرکزی</title>
</head>
<body>
  <header><nav><ul><li><a href="#home">خانه</a></li></ul></nav></header>
  <main><div class="hero"><h1>ماهواره مرکزی</h1></div></main>
  <footer></footer>
</body>
</html>`

describe('html validation', () => {
  it('accepts a well-formed document', () => {
    const r = validateHtml(goodPage)
    expect(r.valid).toBe(true)
    expect(r.issues).toHaveLength(0)
    expect(r.warnings).toHaveLength(0)
  })
  it('rejects empty content', () => {
    expect(validateHtml('').valid).toBe(false)
    expect(validateHtml('   ').issues.length).toBeGreaterThan(0)
  })
  it('flags missing doctype, head, body and title', () => {
    const r = validateHtml('<html><body><div>x</div></body></html>')
    expect(r.valid).toBe(false)
    expect(r.issues.some((i) => i.includes('DOCTYPE'))).toBe(true)
    expect(r.issues.some((i) => i.includes('head'))).toBe(true)
    expect(r.issues.some((i) => i.includes('title'))).toBe(true)
  })
  it('detects unbalanced container tags', () => {
    const broken = goodPage.replace('</div>', '').replace('<title>t</title>', '<title>t</title>')
    const r = validateHtml(broken)
    expect(r.valid).toBe(false)
    expect(r.issues.some((i) => i.includes('<div>'))).toBe(true)
  })
  it('warns about missing viewport and img alt', () => {
    const noViewport = goodPage.replace(/<meta name="viewport"[^>]*>/, '')
    expect(validateHtml(noViewport).warnings.some((w) => w.includes('viewport'))).toBe(true)
    const withImg = goodPage.replace('</main>', '<img src="x.png"></main>')
    expect(validateHtml(withImg).warnings.some((w) => w.includes('alt'))).toBe(true)
  })
})

describe('html extraction from agent output', () => {
  it('extracts fenced html block', () => {
    const out = 'توضیح:\n```html\n' + goodPage + '\n```\nپایان'
    expect(extractHtml(out)).toContain('<!DOCTYPE html>')
  })
  it('extracts bare document without fences', () => {
    const out = 'اینا سایت شماست:\n' + goodPage
    expect(extractHtml(out)).toContain('</html>')
  })
  it('returns null when no html present', () => {
    expect(extractHtml('پاسخ متنی بدون کد')).toBeNull()
  })
})

describe('page title extraction', () => {
  it('reads title tag', () => {
    expect(titleFromHtml(goodPage)).toBe('سایت ماهواره مرکزی')
  })
  it('falls back to default title', () => {
    expect(titleFromHtml('<html><head></head></html>')).toBe('صفحه بدون عنوان')
  })
})
