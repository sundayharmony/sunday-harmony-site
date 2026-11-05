import { mailingAddressIsValid } from './activation'
import { OUTREACH_CTA_URL, OUTREACH_SENDER_EMAIL } from './constants'
import type { OutreachStore } from './store'

export function stripClientVerificationFields(body: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...body }
  delete copy.schemaReady
  delete copy.senderConfigured
  delete copy.historyReconciled
  delete copy.optOutVerified
  delete copy.activated
  delete copy.activatedAt
  delete copy.killSwitch
  delete copy.kill_switch
  delete copy.historyReconciliationStatus
  delete copy.providerConfirmed
  delete copy.liveSend
  return copy
}

export async function applyOperatorSettings(
  store: OutreachStore,
  raw: Record<string, unknown>,
  actorId: string
): Promise<{ ok: boolean; error?: string }> {
  const body = stripClientVerificationFields(raw)
  const patch: {
    physicalMailingAddress?: string | null
    dailySendLimit?: number
    settingsVersion?: number
  } = {}
  if ('physicalMailingAddress' in body) {
    const value = typeof body.physicalMailingAddress === 'string' ? body.physicalMailingAddress.trim() : ''
    if (value && !mailingAddressIsValid(value)) {
      return { ok: false, error: 'Mailing address is not valid.' }
    }
    patch.physicalMailingAddress = value || null
  }
  if ('dailySendLimit' in body) {
    const limit = Number(body.dailySendLimit)
    if (!Number.isInteger(limit) || limit < 0 || limit > 200) {
      return { ok: false, error: 'Daily send limit must be an integer from 0 to 200.' }
    }
    patch.dailySendLimit = limit
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'No allowed settings fields.' }
  }
  const current = await store.getSettings()
  const material = Object.keys(patch).some(
    (key) => (patch as Record<string, unknown>)[key] !== (current as Record<string, unknown>)[key]
  )
  if (!material) {
    return { ok: true }
  }
  patch.settingsVersion = current.settingsVersion + 1
  const campaign = await store.getCampaignBySlug('prospect-intro')
  if (campaign) {
    await store.unapproveLatestTemplate(campaign.id, 'settings_changed', actorId)
  }
  await store.updateSettings(patch)
  await store.addAudit({
    actorType: 'staff',
    actorId,
    action: 'settings_updated',
    entityType: 'settings',
    entityId: '1',
    payload: { fields: Object.keys(patch) },
  })
  return { ok: true }
}

export function senderMustMatch(): string {
  return OUTREACH_SENDER_EMAIL
}

export function ctaMustMatch(): string {
  return OUTREACH_CTA_URL
}
