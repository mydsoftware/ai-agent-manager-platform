export type MCPServerConfig = { name: string; url: string; token?: string; enabled?: boolean }
export async function mcpListTools(server: MCPServerConfig) {
  if (server.enabled === false) return []
  const headers: Record<string,string> = { accept: 'application/json' }
  if (server.token) headers.authorization = `Bearer ${server.token}`
  const response = await fetch(server.url.replace(/\/$/, '') + '/tools', { headers })
  if (!response.ok) throw new Error(`MCP_SERVER_${response.status}`)
  const data: any = await response.json()
  return Array.isArray(data?.tools) ? data.tools : []
}
export async function mcpCallTool(server: MCPServerConfig, name: string, input: unknown) {
  if (server.enabled === false) throw new Error('MCP_DISABLED')
  const headers: Record<string,string> = { 'content-type': 'application/json', accept: 'application/json' }
  if (server.token) headers.authorization = `Bearer ${server.token}`
  const response = await fetch(server.url.replace(/\/$/, '') + '/tools/' + encodeURIComponent(name), { method: 'POST', headers, body: JSON.stringify({ input }) })
  if (!response.ok) throw new Error(`MCP_TOOL_${response.status}`)
  return response.json()
}
