import type { OutreachStore } from './store'
import { hashUnsubscribeToken } from './unsubscribe'

export async function confirmUnsubscribe(store: OutreachStore, token: string, at = store.now()) {
  const hash = hashUnsubscribeToken(token)
  const row = await store.findUnsubscribeToken(hash)
  if (!row) return { ok: false as const, reason: 'invalid' }
  await store.addSuppression({
    emailNormalized: row.emailNormalized,
    reason: 'unsubscribe',
    source: 'user',
    confirmationStatus: 'confirmed',
    notes: 'Public unsubscribe confirmation',
  })
  await store.confirmUnsubscribeToken(hash, at.toISOString())
  const queue = await store.listQueue()
  for (const item of queue) {
    if (item.emailNormalized !== row.emailNormalized) continue
    if (item.status === 'pending' || item.status === 'claimed') {
      await store.compareAndSwap(item.id, item.status, {
        status: 'suppressed',
        eligibilityReason: 'unsubscribed',
      })
    }
  }
  await store.addAudit({
    actorType: 'public',
    actorId: null,
    action: 'unsubscribed',
    entityType: 'suppression',
    entityId: row.emailNormalized,
    payload: { queueId: row.queueId },
  })
  return { ok: true as const }
}
