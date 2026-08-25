import { prisma } from './runtime'
import { executeAgentLoop } from './agent-loop'
import { getLLMProvider } from './providers'
import { listTools } from './tools'

export const MATCH_THRESHOLD = 0.34
export const MAX_QUALITY_CYCLES = 3
export const LOOP_MAX_TOKENS = 1200

export type SpecialistSeed = {
  specialty: string
  name: string
  description: string
  systemPrompt: string
  keywords: string[]
  tools: string[]
}

export const SPECIALIST_SEEDS: SpecialistSeed[] = [
  {
    specialty: 'seo',
    name: 'متخصص سئو',
    description: 'بهینه‌سازی موتور جستجو، تحلیل کلیدواژه، محتوای سئو شده و اصلاح ساختار صفحات',
    systemPrompt:
      'تو یک متخصص سئو حرفه‌ای هستی. وظیفه‌ات تحلیل درخواست، پیشنهاد کلیدواژه‌های هدف، ساختار هدینگ‌ها، متا تایتل و دیسکریپشن و محتوای بهینه است. پاسخ‌ها عملی، مرحله‌به‌مرحله و بر اساس بهترین شیوه‌های سئوی سفیدپلبه باشد.',
    keywords: ['سئو', 'seo', 'گوگل', 'کلیدواژه', 'keyword', 'رتبه', 'بک‌لینک', 'ترافیک', 'محتوا'],
    tools: ['json_echo', 'current_time', 'web_search'],
  },
  {
    specialty: 'webdev',
    name: 'متخصص سایت‌ساز',
    description: 'طراحی و ساخت وب‌سایت کامل با HTML/CSS/JS، ریسپانسیو و آماده انتشار',
    systemPrompt:
      'تو یک مهندس وب ارشد هستی. خروجی تو کد کامل، تمیز و بدون خطای وب‌سایت است (HTML/CSS/JS). همیشه کد را کامل بده، سازگاری موبایل/دسکتاپ، دسترس‌پذیری و عملکرد را رعایت کن و در پایان چک‌لیست صحت را بررسی کن.',
    keywords: ['سایت', 'وبسایت', 'وب', 'website', 'landing', 'صفحه', 'فرانت‌اند', 'html', 'css', 'طراحی سایت', 'سایت ساز'],
    tools: ['json_echo', 'current_time', 'web_search'],
  },
  {
    specialty: 'wordpress',
    name: 'متخصص وردپرس',
    description: 'راه‌اندازی و توسعه وردپرس: قالب، افزونه، ووکامرس و رفع مشکلات',
    systemPrompt:
      'تو متخصص وردپرس هستی. برای هر درخواست راهکار استاندارد وردپرسی می‌دهی: انتخاب قالب، افزونه‌های لازم، کدهای functions.php، شورت‌کد یا بلوک، نکات امنیت و سرعت. خروجی دقیق و قابل اجرا باشد.',
    keywords: ['وردپرس', 'wordpress', 'ووکامرس', 'woocommerce', 'قالب', 'theme', 'افزونه', 'plugin', 'elementor'],
    tools: ['json_echo', 'current_time', 'web_search'],
  },
  {
    specialty: 'programming',
    name: 'متخصص برنامه‌نویس',
    description: 'نوشتن، دیباگ و بازبینی کد در زبان‌های مختلف با تست و مستندسازی',
    systemPrompt:
      'تو یک برنامه‌نویس ارشد هستی. مسئله را دقیق بفهم، راه‌حل را طرح ریزی کن، کد کامل و اجرایی بنویس، موارد لبه و خطاها را مدیریت کن و در پایان تست‌ها و نحوه اجرا را بده.',
    keywords: ['برنامه', 'کد', 'code', 'اسکریپت', 'باگ', 'bug', 'دیباگ', 'api', 'پایتون', 'python', 'جاوااسکریپت', 'javascript', 'node'],
    tools: ['json_echo', 'current_time', 'web_search'],
  },
]

export function requestTerms(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((x) => x.length >= 2)
    .slice(0, 40)
}

export function matchScore(requestTermsList: string[], agentRow: any): number {
  const haystack = new Set<string>()
  for (const term of requestTerms(String(agentRow?.name || ''))) haystack.add(term)
  for (const term of requestTerms(String(agentRow?.description || ''))) haystack.add(term)
  for (const term of requestTerms(String(agentRow?.specialty || ''))) haystack.add(term)
  const keywords = Array.isArray(agentRow?.keywords) ? agentRow.keywords : safeParseArray(agentRow?.keywords)
  for (const kw of keywords.map(String)) {
    haystack.add(kw.toLowerCase())
    for (const term of requestTerms(kw)) haystack.add(term)
  }
  if (!requestTermsList.length || !haystack.size) return 0
  let hits = 0
  for (const term of requestTermsList) if (haystack.has(term)) hits++
  return hits / requestTermsList.length
}

function safeParseArray(value: unknown): unknown[] {
  try {
    if (typeof value === 'string') return JSON.parse(value)
  } catch {}
  return []
}

export function decideMatch(score: number): boolean {
  return score >= MATCH_THRESHOLD
}

export async function findBestSpecialist(tenantId: string, request: string): Promise<{ agent: any; score: number } | null> {
  const terms = requestTerms(request)
  const agents = await prisma.agent.findMany({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  let best: { agent: any; score: number } | null = null
  for (const agent of agents) {
    const score = matchScore(terms, agent)
    if (!best || score > best.score) best = { agent, score }
  }
  if (best && decideMatch(best.score)) return best
  return null
}

const AVAILABLE_TOOLS = new Set(listTools().map((t) => t.name))

export type GeneratedSpec = {
  name: string
  slug: string
  description: string
  systemPrompt: string
  keywords: string[]
  specialty: string
  tools: string[]
}

export function validateGeneratedSpec(raw: unknown): GeneratedSpec | null {
  const spec: any = typeof raw === 'string' ? safeParseJson(raw) : raw
  if (!spec || typeof spec !== 'object') return null
  const name = typeof spec.name === 'string' ? spec.name.trim() : ''
  const systemPrompt = typeof spec.systemPrompt === 'string' ? spec.systemPrompt.trim() : ''
  const description = typeof spec.description === 'string' ? spec.description.trim() : ''
  if (!name || !systemPrompt || !description) return null
  const specialty = String(spec.specialty || 'general').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'general'
  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const slug = (slugBase || 'agent') + '-auto'
  const keywords = Array.isArray(spec.keywords) ? spec.keywords.map((k: any) => String(k).trim()).filter(Boolean).slice(0, 15) : []
  const tools = Array.isArray(spec.tools) ? spec.tools.map(String).filter((t: string) => AVAILABLE_TOOLS.has(t)) : []
  return {
    name: name.slice(0, 80),
    slug: slug.slice(0, 48),
    description: description.slice(0, 500),
    systemPrompt: systemPrompt.slice(0, 4000),
    keywords,
    specialty,
    tools: tools.length ? tools : ['json_echo', 'current_time'],
  }
}

function safeParseJson(text: string): any {
  try {
    const parsed = JSON.parse(extractJsonBlock(String(text)))
    return parsed
  } catch {
    return null
  }
}

function extractJsonBlock(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : text
}

export async function generateSpecialist(tenantId: string, request: string): Promise<{ agent: any; spec: GeneratedSpec }> {
  const provider = getLLMProvider()
  const response = await provider.generate({
    system:
      'تو مدیر ایجنت هستی و باید برای درخواست مشتری، مشخصات یک ایجنت متخصص تولید کنی. فقط و فقط JSON زیر را برگردان: {"name":"نام فارسی ایجنت","description":"توضیح یک پاراگرافی تخصص","systemPrompt":"پرامپت سیستمی کامل و حرفه‌ای برای این متخصص","keywords":["کلیدواژه1","کلیدواژه2"],"specialty":"شناسه انگلیسی تخصص مثل seo/webdev/wordpress/programming/general","tools":["json_echo","current_time","web_search"]}',
    prompt: `درخواست مشتری:\n${String(request).slice(0, 2000)}\n\nمشخصات ایجنت متخصص مناسب را در قالب JSON بده.`,
    temperature: 0.3,
    maxTokens: LOOP_MAX_TOKENS,
  })
  const spec = validateGeneratedSpec(response.text)
  if (!spec) throw new Error('SPEC_GENERATION_FAILED')
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  const rows = await prisma.$queryRaw`
    INSERT INTO agents (id, "tenantId", name, slug, description, "systemPrompt", tools, permissions, "riskLevel", "approvalPolicy", specialty, keywords, origin, "isActive", "createdAt", "updatedAt")
    VALUES (${id}, ${tenantId}, ${spec.name}, ${spec.slug}, ${spec.description}, ${spec.systemPrompt},
      ${JSON.stringify(spec.tools)}::jsonb, '[]'::jsonb, 'LOW', 'AUTO',
      ${spec.specialty}, ${JSON.stringify(spec.keywords)}::jsonb, 'AUTO_GENERATED', true, NOW(), NOW())
    RETURNING *
  ` as any[]
  return { agent: Array.isArray(rows) ? rows[0] : rows, spec }
}

export async function ensureSpecialistSeeds(tenantId: string): Promise<void> {
  const existing = await prisma.agent.findMany({
    where: { tenantId, origin: 'SEED' },
    select: { specialty: true },
  })
  const have = new Set(existing.map((e) => e.specialty))
  for (const seed of SPECIALIST_SEEDS) {
    if (have.has(seed.specialty)) continue
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    await prisma.$executeRaw`
      INSERT INTO agents (id, "tenantId", name, slug, description, "systemPrompt", tools, permissions, "riskLevel", "approvalPolicy", specialty, keywords, origin, "isActive", "createdAt", "updatedAt")
      VALUES (${id}, ${tenantId}, ${seed.name}, ${seed.specialty + '-seed'}, ${seed.description}, ${seed.systemPrompt},
        ${JSON.stringify(seed.tools)}::jsonb, '[]'::jsonb, 'LOW', 'AUTO',
        ${seed.specialty}, ${JSON.stringify(seed.keywords)}::jsonb, 'SEED', true, NOW(), NOW())
    `
  }
}

export type Verdict = { pass: boolean; issues: string[] }

export function parseVerdict(text: string): Verdict {
  const parsed = safeParseJson(text)
  if (parsed && typeof parsed === 'object') {
    return {
      pass: parsed.pass === true,
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((i: any) => String(i)).slice(0, 10) : [],
    }
  }
  return { pass: false, issues: ['VERDICT_PARSE_FAILED'] }
}

export async function verifyOutput(requirement: string, output: string): Promise<Verdict> {
  const provider = getLLMProvider()
  const response = await provider.generate({
    system:
      'تو کنترل کیفیت خروجی ایجنت‌ها هستی. آیا خروجی، نیاز مشتری را کامل و بدون نقص برآورده می‌کند؟ فقط JSON برگردان: {"pass":true} یا {"pass":false,"issues":["نقص ۱","نقص ۲"]}. سخت‌گیر باش؛ اگر خروجی ناقص، خراب یا بی‌ربط است pass=false بده.',
    prompt: `نیاز مشتری:\n${requirement.slice(0, 2000)}\n\nخروجی ایجنت:\n${output.slice(0, 6000)}`,
    temperature: 0,
    maxTokens: 500,
  })
  return parseVerdict(response.text)
}

export type OrchestrateOptions = {
  tenantId: string;
  userId: string;
  input: string;
  maxCycles?: number;
};

export type OrchestrationEvent =
  | { type: 'status'; status: 'searching' }
  | { type: 'agent'; source: 'FOUND' | 'CREATED' | 'SEED'; agentId: string; agentName: string; specialty?: string }
  | { type: 'cycle'; cycle: number; maxCycles: number }
  | { type: 'verifying'; cycle: number }
  | { type: 'retry'; cycle: number; issues: string[] }
  | { type: 'done'; result: OrchestrationResult }
  | { type: 'error'; error: string };

export type OrchestrationResult = {
  source: 'FOUND' | 'CREATED' | 'SEED';
  agent: { id: string; name: string; specialty?: string };
  cycles: number;
  output: string;
  tokensUsed: number;
  verdict: Verdict;
};

export async function orchestrate(options: OrchestrateOptions, emit?: (event: OrchestrationEvent) => void): Promise<OrchestrationResult> {
  const report = (event: OrchestrationEvent) => emit?.(event)
  await ensureSpecialistSeeds(options.tenantId)

  report({ type: 'status', status: 'searching' })
  const match = await findBestSpecialist(options.tenantId, options.input)
  let agent: any
  let source: OrchestrationResult['source']
  if (match) {
    agent = match.agent
    source = 'FOUND'
    report({ type: 'agent', source, agentId: agent.id, agentName: agent.name, specialty: agent.specialty ?? undefined })
  } else {
    const generated = await generateSpecialist(options.tenantId, options.input)
    agent = generated.agent
    source = 'CREATED'
    report({ type: 'agent', source, agentId: agent.id, agentName: agent.name, specialty: agent.specialty ?? undefined })
  }

  const maxCycles = Math.min(Math.max(options.maxCycles ?? MAX_QUALITY_CYCLES, 1), 5)
  let requirement = String(options.input)
  let totalTokens = 0
  let lastOutput = ''
  let lastVerdict: Verdict = { pass: false, issues: [] }
  let cyclesUsed = 0

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    cyclesUsed = cycle
    report({ type: 'cycle', cycle, maxCycles })
    const loopInput: Record<string, unknown> = cycle === 1 ? { task: requirement } : { task: requirement, previousAttempt: lastOutput, fixIssues: lastVerdict.issues }
    const result = await executeAgentLoop({ agent, tenantId: options.tenantId, userId: options.userId, input: loopInput, maxIterations: 6 })
    totalTokens += result.tokensUsed
    lastOutput = result.text
    report({ type: 'verifying', cycle })
    lastVerdict = await verifyOutput(requirement, lastOutput)
    if (lastVerdict.pass) break
    if (cycle < maxCycles) report({ type: 'retry', cycle, issues: lastVerdict.issues })
  }

  const finalResult: OrchestrationResult = {
    source,
    agent: { id: agent.id, name: agent.name, specialty: agent.specialty ?? undefined },
    cycles: cyclesUsed,
    output: lastOutput,
    tokensUsed: totalTokens,
    verdict: lastVerdict,
  }
  report({ type: 'done', result: finalResult })
  return finalResult
}
