import { OUTREACH_LEASE_MS } from './constants'
import type { OutreachStore } from './store'
import type { QueueItem } from './types'

export async function claimNextPending(
  store: OutreachStore,
  workerId: string,
  at: Date = store.now(),
  options?: { ignoreBackoff?: boolean }
): Promise<QueueItem | null> {
  const items = await store.listQueue()
  const nowMs = at.getTime()
  const ignoreBackoff = Boolean(options?.ignoreBackoff)
  const candidates = items
    .filter((item) => {
      if (item.status === 'pending') {
        if (ignoreBackoff) return true
        return new Date(item.nextAttemptAt).getTime() <= nowMs
      }
      if (
        item.status === 'claimed' &&
        item.leaseExpiresAt &&
        new Date(item.leaseExpiresAt).getTime() <= nowMs
      ) {
        return true
      }
      return false
    })
    .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt) || a.id.localeCompare(b.id))

  for (const candidate of candidates) {
    const expected = candidate.status
    const claimed = await store.compareAndSwap(candidate.id, expected, {
      status: 'claimed',
      claimedBy: workerId,
      claimedAt: at.toISOString(),
      leaseExpiresAt: new Date(nowMs + OUTREACH_LEASE_MS).toISOString(),
    })
    if (claimed) return claimed
  }
  return null
}

export async function recoverExpiredInFlight(store: OutreachStore, at: Date = store.now()): Promise<number> {
  const items = await store.listQueue()
  let marked = 0
  for (const item of items) {
    if (item.status !== 'in_flight') continue
    if (item.leaseExpiresAt && new Date(item.leaseExpiresAt).getTime() > at.getTime()) continue
    const updated = await store.compareAndSwap(item.id, 'in_flight', {
      status: 'needs_review',
      eligibilityReason: 'uncertain_after_inflight_timeout',
    })
    if (updated) {
      marked += 1
      await store.addAudit({
        actorType: 'system',
        actorId: 'outreach-dispatch',
        action: 'needs_review',
        entityType: 'queue',
        entityId: item.id,
        payload: { reason: 'expired_in_flight', providerIdempotencyKey: item.providerIdempotencyKey },
      })
    }
  }
  return marked
}
