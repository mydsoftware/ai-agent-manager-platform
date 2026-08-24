import { getTool } from './tools'
import { validateToolPermission } from './policy'

/** اجرای مستقیم Tool فقط بعد از تطبیق Agent با Tenant و Policy مجاز است. */
export function authorizeToolExecution(agent: any, tenantId: string, toolName: string) {
  if (!agent || agent.tenantId !== tenantId) throw new Error('AGENT_NOT_FOUND')
  const tool = getTool(toolName)
  if (!tool) throw new Error('TOOL_NOT_FOUND')
  validateToolPermission(agent, tool)
  return tool
}
