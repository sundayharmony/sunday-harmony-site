import { confirmUnsubscribe } from './confirm-unsubscribe'
import type { OutreachStore } from './store'
import { createUnsubscribeToken, hashUnsubscribeToken } from './unsubscribe'

export const OPT_OUT_PROBE_EMAIL = 'outreach-opt-out-probe@invalid'

export async function verifyOptOutCapability(store: OutreachStore, actorId: string) {
  const token = createUnsubscribeToken()
  const tokenHash = hashUnsubscribeToken(token)
  await store.putUnsubscribeToken({
    tokenHash,
    emailNormalized: OPT_OUT_PROBE_EMAIL,
    leadId: null,
    queueId: null,
  })
  const stored = await store.findUnsubscribeToken(tokenHash)
  if (!stored) {
    return { ok: false as const, reason: 'token_persist_failed' }
  }
  const confirmed = await confirmUnsubscribe(store, token)
  if (!confirmed.ok) {
    return { ok: false as const, reason: 'confirm_failed' }
  }
  const suppression = await store.findSuppression(OPT_OUT_PROBE_EMAIL)
  if (!suppression) {
    return { ok: false as const, reason: 'suppression_missing' }
  }
  const at = store.now().toISOString()
  await store.updateSettings({ optOutVerifiedAt: at })
  await store.addAudit({
    actorType: 'staff',
    actorId,
    action: 'opt_out_verified',
    entityType: 'settings',
    entityId: '1',
    payload: { probe: OPT_OUT_PROBE_EMAIL },
  })
  return { ok: true as const, verifiedAt: at }
}
