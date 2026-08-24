export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ApprovalPolicy = 'AUTO' | 'CONFIRM_MEDIUM' | 'CONFIRM_HIGH' | 'CONFIRM_ALL'
const rank: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }
export function requiresApproval(risk: RiskLevel, policy: ApprovalPolicy) {
  if (policy === 'AUTO') return false
  if (policy === 'CONFIRM_ALL') return true
  if (policy === 'CONFIRM_HIGH') return rank[risk] >= rank.HIGH
  return rank[risk] >= rank.MEDIUM
}
export function validateToolPermission(agent: any, tool: any) {
  const allowed = new Set((agent.tools || []).map(String))
  if (!allowed.has(tool.name)) throw new Error('TOOL_NOT_ALLOWED')
  if (rank[tool.risk as RiskLevel] > rank[(agent.riskLevel || 'LOW') as RiskLevel]) throw new Error('AGENT_RISK_POLICY_BLOCKED')
  if (requiresApproval(tool.risk, (agent.approvalPolicy || 'AUTO') as ApprovalPolicy)) throw new Error('APPROVAL_REQUIRED')
}
