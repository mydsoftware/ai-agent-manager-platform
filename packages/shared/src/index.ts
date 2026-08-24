export const PLANS = { FREE: 'FREE', STARTER: 'STARTER', PRO: 'PRO', BUSINESS: 'BUSINESS', AGENCY: 'AGENCY', ENTERPRISE: 'ENTERPRISE' } as const;
export type PlanKey = (typeof PLANS)[keyof typeof PLANS];
export const RISK_LEVELS = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' } as const;
export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];
export const PERMISSIONS = {
  'tenant:read': 'tenant:read', 'tenant:update': 'tenant:update', 'tenant:admin': 'tenant:admin',
  'user:read': 'user:read', 'user:invite': 'user:invite',
  'agent:read': 'agent:read', 'agent:create': 'agent:create', 'agent:run': 'agent:run', 'agent:manage': 'agent:manage',
  'billing:read': 'billing:read', 'billing:manage': 'billing:manage', 'audit:read': 'audit:read',
} as const;
export type Locale = 'fa' | 'en';
export const DEFAULT_LOCALE: Locale = 'fa';
