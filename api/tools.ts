export type ToolContext = { tenantId: string; userId: string }
export type ToolDefinition = { name: string; description: string; risk: 'LOW' | 'MEDIUM' | 'HIGH'; execute: (input: any, context: ToolContext) => Promise<any> }

import { saveGeneratedPage, validateHtml, pageDb } from './pages'

const tools = new Map<string, ToolDefinition>()

export function registerTool(tool: ToolDefinition) { tools.set(tool.name, tool) }
export function getTool(name: string) { return tools.get(name) }
export function listTools() { return [...tools.values()].map(({ execute, ...meta }) => meta) }

registerTool({
  name: 'json_echo',
  description: 'داده ورودی را بدون تغییر برمی‌گرداند؛ مناسب تست Tool Engine.',
  risk: 'LOW',
  async execute(input) { return { ok: true, data: input } }
})

registerTool({
  name: 'current_time',
  description: 'زمان فعلی سرور را برمی‌گرداند.',
  risk: 'LOW',
  async execute() { return { iso: new Date().toISOString() } }
})

registerTool({
  name: 'web_search',
  description: 'جستجوی وب از طریق ارائه‌دهنده سازگار با OpenAI برای ابزار جستجو.',
  risk: 'LOW',
  async execute(input) {
    const query = String(input?.query || '').trim()
    if (!query || query.length > 500) throw new Error('INVALID_SEARCH_QUERY')
    const endpoint = process.env.SEARCH_API_URL
    const apiKey = process.env.SEARCH_API_KEY
    if (!endpoint || !apiKey) throw new Error('SEARCH_PROVIDER_NOT_CONFIGURED')
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ query, limit: Math.min(Math.max(Number(input?.limit) || 5, 1), 10) }) })
    if (!response.ok) throw new Error(`SEARCH_PROVIDER_ERROR_${response.status}`)
    const data: any = await response.json()
    return { query, results: Array.isArray(data?.results) ? data.results.slice(0, 10) : data?.results || data }
  }
})

registerTool({
  name: 'save_page',
  description: 'کد کامل HTML سایت را ذخیره می‌کند و لینک پیش‌نمایش عمومی برمی‌گرداند. حتماً لینک برگشتی را به کاربر اعلام کن.',
  risk: 'LOW',
  async execute(input, context) {
    const result = await saveGeneratedPage(pageDb, context.tenantId, input)
    return { ok: true, url: result.url, slug: result.page.slug, title: result.page.title, previewUrl: result.url, check: result.check }
  }
})

registerTool({
  name: 'html_validate',
  description: 'کد HTML داده‌شده را از نظر ساختار (DOCTYPE، تگ‌های باز/بسته، title، viewport) اعتبارسنجی می‌کند و فهرست ایرادها را برمی‌گرداند.',
  risk: 'LOW',
  async execute(input) {
    const html = String(input?.html || '')
    if (!html.trim()) throw new Error('EMPTY_HTML')
    return validateHtml(html)
  }
})

export async function executeTool(name: string, input: unknown, context: ToolContext) {
  if (!context?.tenantId || !context?.userId) throw new Error('INVALID_TOOL_CONTEXT')
  if (context.tenantId.length > 200 || context.userId.length > 200) throw new Error('INVALID_TOOL_CONTEXT')
  const tool = getTool(name)
  if (!tool) throw new Error('TOOL_NOT_FOUND')
  return tool.execute(input, context)
}
