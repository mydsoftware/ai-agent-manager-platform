export type LeadSignal = {
  needFit?: number
  budgetFit?: number
  locationFit?: number
  timingFit?: number
  decisionAuthority?: number
  engagement?: number
}

export type LeadScore = {
  score: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  factors: Array<{ key: keyof LeadSignal; value: number; weight: number; contribution: number }>
}

export type ContactPolicyInput = {
  connectorEnabled: boolean
  permissionGranted: boolean
  consentRecorded: boolean
  consentRevoked?: boolean
  legalBasisRecorded: boolean
  suppressed: boolean
  withinAllowedWindow: boolean
  underRateLimit: boolean
  approvalGranted: boolean
}

export type ContactDecision = {
  allowed: boolean
  reasons: string[]
}

const WEIGHTS: Record<keyof LeadSignal, number> = {
  needFit: 0.30,
  budgetFit: 0.20,
  locationFit: 0.10,
  timingFit: 0.15,
  decisionAuthority: 0.15,
  engagement: 0.10,
}

/** امتیازدهی قطعی و قابل توضیح؛ مقدار هر سیگنال باید بین صفر تا صد باشد. */
export function scoreLead(signals: LeadSignal): LeadScore {
  const factors: LeadScore['factors'] = []
  let weighted = 0
  let availableWeight = 0
  for (const key of Object.keys(WEIGHTS) as Array<keyof LeadSignal>) {
    const raw = signals[key]
    if (raw === undefined || raw === null) continue
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) throw new Error('INVALID_LEAD_SIGNAL')
    const weight = WEIGHTS[key]
    const contribution = raw * weight
    weighted += contribution
    availableWeight += weight
    factors.push({ key, value: raw, weight, contribution: Number(contribution.toFixed(2)) })
  }
  if (!factors.length) return { score: 0, confidence: 'LOW', factors: [] }
  const score = Math.round(weighted / availableWeight)
  const coverage = availableWeight
  const confidence = coverage >= 0.85 ? 'HIGH' : coverage >= 0.5 ? 'MEDIUM' : 'LOW'
  return { score, confidence, factors }
}

/** ارسال تنها وقتی مجاز است که همه شروط ایمنی و رضایت برقرار باشند. */
export function evaluateContactPolicy(input: ContactPolicyInput): ContactDecision {
  const reasons: string[] = []
  if (!input.connectorEnabled) reasons.push('CONNECTOR_DISABLED')
  if (!input.permissionGranted) reasons.push('CONNECTOR_PERMISSION_MISSING')
  if (!input.consentRecorded && !input.legalBasisRecorded) reasons.push('NO_VALID_CONTACT_BASIS')
  if (input.consentRevoked) reasons.push('CONSENT_REVOKED')
  if (input.suppressed) reasons.push('RECIPIENT_SUPPRESSED')
  if (!input.withinAllowedWindow) reasons.push('OUTSIDE_ALLOWED_WINDOW')
  if (!input.underRateLimit) reasons.push('RATE_LIMIT_EXCEEDED')
  if (!input.approvalGranted) reasons.push('APPROVAL_REQUIRED')
  return { allowed: reasons.length === 0, reasons }
}

/** نرمال‌سازی حداقلی متن برای deduplication؛ داده خام اصلی باید جداگانه با provenance نگهداری شود. */
export function normalizeLeadKey(value: string): string {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('fa-IR').replace(/\s+/g, ' ')
}
