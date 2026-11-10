import { OUTREACH_LEASE_MS, OUTREACH_READY_QUEUE_SIZE } from './constants'
import type { OutreachStore } from './store'
import type { QueueItem } from './types'

export async function claimNextPending(
  store: OutreachStore,
  workerId: string,
  at: Date = store.now(),
  options?: { ignoreBackoff?: boolean; excludeIds?: ReadonlySet<string> }
): Promise<QueueItem | null> {
  const nowMs = at.getTime()
  const ignoreBackoff = Boolean(options?.ignoreBackoff)
  const excludeIds = options?.excludeIds
  // Prefer status-filtered summaries so older pending rows are not buried under a
  // default PostgREST page of recent accepted history from listQueue().
  const [pending, claimedRows] = await Promise.all([
    store.listQueueSummaries({
      statuses: ['pending'],
      order: 'queue',
      limit: Math.max(OUTREACH_READY_QUEUE_SIZE * 5, 50),
    }),
    store.listQueueSummaries({
      statuses: ['claimed'],
      order: 'queue',
      limit: 30,
    }),
  ])

  const candidates = [...pending, ...claimedRows]
    .filter((item) => {
      if (excludeIds?.has(item.id)) return false
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
  const items = await store.listQueueSummaries({
    statuses: ['in_flight'],
    order: 'queue',
    limit: 50,
  })
  let marked = 0
  for (const item of items) {
    if (item.leaseExpiresAt && new Date(item.leaseExpiresAt).getTime() > at.getTime()) continue
    // Full row needed before audit payload; summaries omit provider keys occasionally.
    const full = (await store.getQueueItem(item.id)) || item
    const updated = await store.compareAndSwap(full.id, 'in_flight', {
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
        entityId: full.id,
        payload: { reason: 'expired_in_flight', providerIdempotencyKey: full.providerIdempotencyKey },
      })
    }
  }
  return marked
}
