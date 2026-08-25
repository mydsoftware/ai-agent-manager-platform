import { describe, expect, it } from 'vitest'
import {
  MATCH_THRESHOLD,
  SPECIALIST_SEEDS,
  decideMatch,
  matchScore,
  parseVerdict,
  requestTerms,
  validateGeneratedSpec,
} from '../api/orchestrator'

describe('specialist matching', () => {
  const siteBuilderAgent = {
    name: 'متخصص سایت‌ساز',
    description: 'طراحی و ساخت وب‌سایت کامل با html css js',
    specialty: 'webdev',
    keywords: ['سایت', 'وبسایت', 'html', 'css', 'طراحی سایت'],
  }
  it('scores keyword overlap between request and specialist', () => {
    const terms = requestTerms('میخواهم یک سایت برای ماهواره مرکزی بسازم')
    expect(matchScore(terms, siteBuilderAgent)).toBeGreaterThan(0)
  })
  it('returns zero for unrelated specialists', () => {
    const terms = requestTerms('پختن غذای سنتی')
    expect(matchScore(terms, siteBuilderAgent)).toBe(0)
  })
  it('matches keywords even when only present in keywords list', () => {
    const terms = requestTerms('وردپرس')
    expect(matchScore(terms, { ...siteBuilderAgent, keywords: ['وردپرس'] })).toBeGreaterThan(0)
  })
  it('applies threshold decision consistently', () => {
    expect(decideMatch(MATCH_THRESHOLD)).toBe(true)
    expect(decideMatch(MATCH_THRESHOLD - 0.01)).toBe(false)
    expect(decideMatch(0)).toBe(false)
  })
})

describe('generated specialist spec validation', () => {
  const valid = {
    name: 'متخصص سایت ماهواره',
    description: 'ساخت سایت شرکتی برای صنعت ماهواره',
    systemPrompt: 'تو متخصص ساخت سایت ماهواره‌ای هستی...',
    keywords: ['ماهواره', 'satellite'],
    specialty: 'Satellite-Web!',
    tools: ['json_echo', 'current_time', 'unknown_tool'],
  }
  it('accepts a complete spec and sanitizes fields', () => {
    const spec = validateGeneratedSpec(valid)!
    expect(spec.name).toBe('متخصص سایت ماهواره')
    expect(spec.specialty).toBe('satellite-web')
    expect(spec.slug).toMatch(/-auto$/)
    expect(spec.tools).toEqual(['json_echo', 'current_time'])
    expect(spec.keywords).toEqual(['ماهواره', 'satellite'])
  })
  it('parses JSON embedded in LLM prose', () => {
    const spec = validateGeneratedSpec('خب این هم مشخصات:\n' + JSON.stringify(valid) + '\nموفق باشید')!
    expect(spec).not.toBeNull()
    expect(spec.tools).toHaveLength(2)
  })
  it('rejects incomplete or invalid specs', () => {
    expect(validateGeneratedSpec(null)).toBeNull()
    expect(validateGeneratedSpec('not json at all')).toBeNull()
    expect(validateGeneratedSpec({ ...valid, name: '' })).toBeNull()
    expect(validateGeneratedSpec({ ...valid, systemPrompt: '' })).toBeNull()
    expect(validateGeneratedSpec({ ...valid, description: 42 as any })).toBeNull()
  })
  it('falls back to safe tools when tools list is empty', () => {
    const spec = validateGeneratedSpec({ ...valid, tools: [] })!
    expect(spec.tools.length).toBeGreaterThan(0)
  })
})

describe('quality verdict parsing', () => {
  it('parses pass verdicts', () => {
    expect(parseVerdict('{"pass":true}')).toEqual({ pass: true, issues: [] })
  })
  it('parses failure with issues list', () => {
    const v = parseVerdict('{"pass":false,"issues":["کد ناقص است","فایل اجرایی ندارد"]}')
    expect(v.pass).toBe(false)
    expect(v.issues).toHaveLength(2)
  })
  it('never crashes on malformed output', () => {
    expect(parseVerdict('random text').pass).toBe(false)
    expect(parseVerdict('').issues.length).toBeGreaterThanOrEqual(1)
  })
})

describe('specialist seeds catalog', () => {
  it('covers the core specialties', () => {
    const ids = SPECIALIST_SEEDS.map((s) => s.specialty)
    for (const required of ['seo', 'webdev', 'wordpress', 'programming']) expect(ids).toContain(required)
  })
  it('every seed is complete and uses registered tool names only', () => {
    const allowed = new Set(['json_echo', 'current_time', 'web_search'])
    for (const seed of SPECIALIST_SEEDS) {
      expect(seed.name.length).toBeGreaterThan(2)
      expect(seed.systemPrompt.length).toBeGreaterThan(40)
      expect(seed.keywords.length).toBeGreaterThan(2)
      for (const tool of seed.tools) expect(allowed.has(tool)).toBe(true)
    }
  })
})
