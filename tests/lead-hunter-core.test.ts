import { describe, expect, it } from 'vitest'
import { evaluateContactPolicy, normalizeLeadKey, scoreLead } from '../api/leads/core'\nimport { ConnectorPolicyError, dispatchApprovedMessage, type ConnectorAdapter } from '../api/leads/connectors'

describe('AI Lead Hunter core', () => {
  it('calculates an explainable weighted score', () => {
    const result = scoreLead({ needFit: 100, budgetFit: 100, locationFit: 100, timingFit: 100, decisionAuthority: 100, engagement: 100 })
    expect(result.score).toBe(100)
    expect(result.confidence).toBe('HIGH')
    expect(result.factors).toHaveLength(6)
  })

  it('normalizes duplicate keys consistently', () => {
    expect(normalizeLeadKey('  خدمات   طراحی سایت ')).toBe(normalizeLeadKey('خدمات طراحی سایت'))
  })

  it('rejects invalid scoring signals', () => {
    expect(() => scoreLead({ needFit: 101 })).toThrow('INVALID_LEAD_SIGNAL')
  })

  it('blocks contact without consent or another legal basis', () => {
    const result = evaluateContactPolicy({
      connectorEnabled: true, permissionGranted: true, consentRecorded: false,
      legalBasisRecorded: false, suppressed: false, withinAllowedWindow: true,
      underRateLimit: true, approvalGranted: true,
    })
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('NO_VALID_CONTACT_BASIS')
  })

  it('blocks revoked consent and suppression even when other checks pass', () => {
    const result = evaluateContactPolicy({
      connectorEnabled: true, permissionGranted: true, consentRecorded: true,
      consentRevoked: true, legalBasisRecorded: true, suppressed: true,
      withinAllowedWindow: true, underRateLimit: true, approvalGranted: true,
    })
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('CONSENT_REVOKED')
    expect(result.reasons).toContain('RECIPIENT_SUPPRESSED')
  })

  it('allows contact only when every policy gate passes', () => {
    const result = evaluateContactPolicy({
      connectorEnabled: true, permissionGranted: true, consentRecorded: true,
      legalBasisRecorded: false, suppressed: false, withinAllowedWindow: true,
      underRateLimit: true, approvalGranted: true,
    })
    expect(result).toEqual({ allowed: true, reasons: [] })
  })
})

