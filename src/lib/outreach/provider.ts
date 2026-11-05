import type { QueueItem } from './types'

export type OutreachSendPayload = {
  to: string
  from: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
  payloadSha256: string
  unsubscribeUrl: string
  attachment: { filename: string; content: Buffer; contentType: string }
}

export type ProviderSendResult =
  | { kind: 'accepted'; providerMessageId: string; threadId?: string }
  | { kind: 'rejected'; retryable: boolean; code: string; message: string }
  | { kind: 'uncertain'; reason: string }

export type OutreachMailProvider = {
  name: string
  supportsIdempotencyRecovery: boolean
  send(payload: OutreachSendPayload): Promise<ProviderSendResult>
  recoverByIdempotencyKey(key: string): Promise<ProviderSendResult | { kind: 'unsupported' }>
}

export type MockProviderControls = {
  results: ProviderSendResult[]
  sendCount: number
  lastPayload: OutreachSendPayload | null
  hangMs?: number
  crashAfterAccept?: boolean
}

export function createMockProvider(controls?: Partial<MockProviderControls>): OutreachMailProvider & MockProviderControls {
  const state: MockProviderControls = {
    results: controls?.results || [{ kind: 'accepted', providerMessageId: 'mock-msg-1', threadId: 'mock-thread-1' }],
    sendCount: 0,
    lastPayload: null,
    hangMs: controls?.hangMs,
    crashAfterAccept: controls?.crashAfterAccept,
  }
  const accepted = new Map<string, ProviderSendResult>()
  const provider: OutreachMailProvider & MockProviderControls = {
    ...state,
    name: 'mock',
    supportsIdempotencyRecovery: true,
    async send(payload) {
      provider.sendCount += 1
      provider.lastPayload = payload
      const prior = accepted.get(payload.idempotencyKey)
      if (prior) return prior
      if (provider.hangMs && provider.hangMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, provider.hangMs))
      }
      const next = provider.results[(provider.sendCount - 1) % provider.results.length]
      if (next.kind === 'accepted') {
        if (provider.crashAfterAccept) {
          throw new Error('simulated_crash_after_accept')
        }
        accepted.set(payload.idempotencyKey, next)
      }
      return next
    },
    async recoverByIdempotencyKey(key) {
      return accepted.get(key) || { kind: 'unsupported' }
    },
  }
  return provider
}

/** Gmail has no durable idempotency key. Timeouts and crashes must not auto-resend. */
export function createGmailOutreachProvider(sendImpl?: {
  sendMime: (payload: OutreachSendPayload) => Promise<{ id: string; threadId: string }>
}): OutreachMailProvider {
  return {
    name: 'gmail',
    supportsIdempotencyRecovery: false,
    async send(payload) {
      if (!sendImpl) {
        return { kind: 'uncertain', reason: 'gmail_adapter_not_bound' }
      }
      try {
        const sent = await sendImpl.sendMime(payload)
        if (!sent.id) return { kind: 'uncertain', reason: 'gmail_missing_id' }
        return { kind: 'accepted', providerMessageId: sent.id, threadId: sent.threadId }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'gmail_error'
        if (/timeout|ETIMEDOUT|ECONNRESET|abort/i.test(message)) {
          return { kind: 'uncertain', reason: 'gmail_timeout' }
        }
        if (/is not set|token refresh failed|unconfigured/i.test(message)) {
          return { kind: 'uncertain', reason: 'gmail_unconfigured' }
        }
        return { kind: 'rejected', retryable: true, code: 'gmail_error', message }
      }
    },
    async recoverByIdempotencyKey() {
      return { kind: 'unsupported' }
    },
  }
}

export function createDisabledProvider(): OutreachMailProvider {
  return {
    name: 'disabled',
    supportsIdempotencyRecovery: false,
    async send() {
      return { kind: 'rejected', retryable: false, code: 'disabled', message: 'Live send is disabled' }
    },
    async recoverByIdempotencyKey() {
      return { kind: 'unsupported' }
    },
  }
}

export function shouldAutoRetry(result: ProviderSendResult, provider: OutreachMailProvider): boolean {
  if (result.kind === 'rejected') return result.retryable
  if (result.kind === 'uncertain') return false
  if (result.kind === 'accepted') return false
  return provider.supportsIdempotencyRecovery
}

export function queueItemPayload(item: QueueItem, from: string, unsubscribeUrl: string, attachment: Buffer): OutreachSendPayload {
  return {
    to: item.emailRaw,
    from,
    subject: item.subject,
    html: item.htmlBody,
    text: item.textBody,
    idempotencyKey: item.providerIdempotencyKey,
    payloadSha256: item.payloadSha256,
    unsubscribeUrl,
    attachment: {
      filename: item.attachmentFilename,
      content: attachment,
      contentType: 'application/pdf',
    },
  }
}
