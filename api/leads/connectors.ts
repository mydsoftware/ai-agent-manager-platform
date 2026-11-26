import { evaluateContactPolicy, type ContactPolicyInput } from './core'

export type ConnectorId = 'divar' | 'sheypoor' | 'telegram' | 'rubika' | 'whatsapp' | 'eitaa' | 'instagram'

export type ConnectorCapabilities = {
  canReceive: boolean
  canSend: boolean
  officialApi: boolean
  supportedMessageKinds: Array<'TEXT' | 'TEMPLATE' | 'MEDIA'>
  notes?: string
}

export type OutboundMessage = {
  recipientId: string
  text: string
  idempotencyKey: string
  purpose: string
}

export type DeliveryResult = {
  providerMessageId: string
  status: 'ACCEPTED' | 'DELIVERED' | 'FAILED'
}

export type ConnectorAdapter = {
  id: ConnectorId
  displayName: string
  capabilities: ConnectorCapabilities
  healthCheck(): Promise<{ ok: boolean; detail?: string }>
  sendMessage(message: OutboundMessage): Promise<DeliveryResult>
}

export class ConnectorPolicyError extends Error {
  constructor(public readonly reasons: string[]) {
    super('CONTACT_POLICY_BLOCKED')
    this.name = 'ConnectorPolicyError'
  }
}

/**
 * ارسال پیام فقط از طریق adapter متصل به API مجاز و پس از عبور از تمام دروازه‌های سیاست.
 * این تابع جایگزین ذخیره‌سازی audit/delivery نیست؛ caller باید نتیجه را ثبت کند.
 */
export async function dispatchApprovedMessage(
  connector: ConnectorAdapter,
  message: OutboundMessage,
  policy: ContactPolicyInput,
): Promise<DeliveryResult> {
  if (!connector.capabilities.canSend || !connector.capabilities.officialApi) {
    throw new ConnectorPolicyError(['CONNECTOR_SEND_NOT_SUPPORTED_BY_VERIFIED_API'])
  }
  if (!message.recipientId.trim() || !message.idempotencyKey.trim() || !message.purpose.trim()) {
    throw new Error('INVALID_OUTBOUND_MESSAGE')
  }
  if (message.text.length === 0 || message.text.length > 4000) {
    throw new Error('INVALID_MESSAGE_LENGTH')
  }
  const decision = evaluateContactPolicy(policy)
  if (!decision.allowed) throw new ConnectorPolicyError(decision.reasons)
  return connector.sendMessage(message)
}
