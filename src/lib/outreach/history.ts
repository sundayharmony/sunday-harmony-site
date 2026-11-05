import type { OutreachStore } from './store'
import { normalizeBusinessName, normalizeEmail } from './email-address'

export type ProviderHistoryEvidence = {
  source: 'gmail_sent'
  retrievedAt: string
  items: Array<{
    email?: string | null
    business?: string | null
    providerMessageId: string
  }>
}

export async function reconcileFromProviderEvidence(
  store: OutreachStore,
  evidence: ProviderHistoryEvidence | { ok: false; reason: string },
  actorId: string
): Promise<{ ok: boolean; reconciled: boolean; remaining: string[] }> {
  if (!('source' in evidence) || evidence.source !== 'gmail_sent') {
    return { ok: false, reconciled: false, remaining: ['evidence_missing'] }
  }
  if (!evidence.items.length) {
    return { ok: false, reconciled: false, remaining: ['empty_provider_history'] }
  }
  const recon = await store.listReconciliationItems()
  const remaining: string[] = []
  for (const item of recon) {
    if (item.treatment !== 'block_review') continue
    if (item.providerConfirmed) continue
    const match = evidence.items.find((row) => {
      if (!row.providerMessageId) return false
      if (item.emailNormalized && row.email && normalizeEmail(row.email) === item.emailNormalized) {
        return true
      }
      if (!item.emailNormalized && row.business && normalizeBusinessName(row.business) === item.businessNormalized) {
        return true
      }
      return false
    })
    if (!match) {
      remaining.push(item.business)
      continue
    }
    await store.markReconProviderConfirmed(item.id, match.providerMessageId)
  }
  if (remaining.length > 0) {
    await store.addAudit({
      actorType: 'staff',
      actorId,
      action: 'history_reconcile_incomplete',
      entityType: 'settings',
      entityId: '1',
      payload: { remaining },
    })
    return { ok: false, reconciled: false, remaining }
  }
  await store.updateSettings({
    historyReconciliationStatus: 'reconciled',
    providerHistoryVerifiedAt: evidence.retrievedAt,
  })
  await store.addAudit({
    actorType: 'staff',
    actorId,
    action: 'history_reconciled',
    entityType: 'settings',
    entityId: '1',
    payload: { source: evidence.source, count: evidence.items.length },
  })
  return { ok: true, reconciled: true, remaining: [] }
}
