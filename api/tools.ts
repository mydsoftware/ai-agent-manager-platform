export type ToolContext = { tenantId: string; userId: string }
export type ToolDefinition = { name: string; description: string; risk: 'LOW' | 'MEDIUM' | 'HIGH'; execute: (input: any, context: ToolContext) => Promise<any> }

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

export async function executeTool(name: string, input: unknown, context: ToolContext) {
  const tool = getTool(name)
  if (!tool) throw new Error('TOOL_NOT_FOUND')
  return tool.execute(input, context)
}
