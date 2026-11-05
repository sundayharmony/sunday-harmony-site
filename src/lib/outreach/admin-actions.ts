import { canRecordActivation, evaluateActivationBlockers, type GateInput } from './activation'
import { loadCompanyPresentationPdf } from './attachment'
import { draftContentSha256 } from './draft-shell'
import { reconcileFromProviderEvidence, type ProviderHistoryEvidence } from './history'
import { applyOperatorSettings, stripClientVerificationFields } from './operator-settings'
import { verifyOptOutCapability } from './opt-out-verify'
import { senderConfiguredHere } from './runtime'
import type { OutreachStore } from './store'
import type { OutreachSettings, OutreachTemplateVersion } from './types'

export type AdminActionResult = {
  ok: boolean
  status: number
  body: Record<string, unknown>
}

function gateFrom(storeState: {
  settings: OutreachSettings
  template: OutreachTemplateVersion | null
  schemaReady: boolean
  env?: NodeJS.ProcessEnv
}): GateInput {
  return {
    settings: storeState.settings,
    template: storeState.template,
    env: storeState.env,
    schemaReady: storeState.schemaReady,
    senderConfigured: senderConfiguredHere(),
    unsubscribeRoutePresent: true,
    attachmentPresent: Boolean(loadCompanyPresentationPdf()),
  }
}

export async function probeSchemaReady(store: OutreachStore): Promise<boolean> {
  try {
    await store.getSettings()
    const campaign = await store.getCampaignBySlug('prospect-intro')
    const template = campaign ? await store.getLatestTemplate(campaign.id) : null
    return Boolean(campaign && template)
  } catch {
    return false
  }
}

export async function loadAdminGate(
  store: OutreachStore,
  env?: NodeJS.ProcessEnv
): Promise<{ schemaReady: boolean; gate: GateInput; settings: OutreachSettings; template: OutreachTemplateVersion | null }> {
  const schemaReady = await probeSchemaReady(store)
  const settings = schemaReady ? await store.getSettings() : {
    id: 1 as const,
    killSwitch: true,
    activatedAt: null,
    activationApprovedBy: null,
    physicalMailingAddress: null,
    senderEmail: 'sales@sundayharmony.com',
    senderDisplayName: 'Sunday Harmony Consulting',
    signerName: 'Mac',
    companyName: 'Sunday Harmony Consulting',
    ctaLabel: 'Pick a time',
    ctaUrl: 'https://www.sundayharmony.com/book',
    dailySendLimit: 0,
    maxAttempts: 5,
    historyReconciliationStatus: 'unknown' as const,
    providerHistoryVerifiedAt: null,
    optOutVerifiedAt: null,
    settingsVersion: 1,
  }
  const campaign = schemaReady ? await store.getCampaignBySlug('prospect-intro') : null
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  return { schemaReady, settings, template, gate: gateFrom({ settings, template, schemaReady, env }) }
}

export async function approveLatestTemplate(store: OutreachStore, actorId: string): Promise<AdminActionResult> {
  const campaign = await store.getCampaignBySlug('prospect-intro')
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  if (!template) return { ok: false, status: 400, body: { error: 'Template missing' } }
  const approved = await store.approveTemplate(template.id, actorId, draftContentSha256(), store.now())
  await store.addAudit({
    actorType: 'staff',
    actorId,
    action: approved ? 'template_approved' : 'template_approve_rejected',
    entityType: 'template',
    entityId: template.id,
    payload: { sha: draftContentSha256() },
  })
  const { gate } = await loadAdminGate(store)
  return {
    ok: Boolean(approved),
    status: 200,
    body: {
      ok: Boolean(approved),
      approved: Boolean(approved?.approved),
      stillDisabled: true,
      blockers: evaluateActivationBlockers(gate),
    },
  }
}

export async function attemptActivation(
  store: OutreachStore,
  input: { actorId: string; clientBody?: Record<string, unknown>; env?: NodeJS.ProcessEnv }
): Promise<AdminActionResult> {
  stripClientVerificationFields(input.clientBody || {})
  const { gate, settings } = await loadAdminGate(store, input.env)
  if (!canRecordActivation(gate)) {
    await store.addAudit({
      actorType: 'staff',
      actorId: input.actorId,
      action: 'activation_attempt_blocked',
      entityType: 'settings',
      entityId: '1',
      payload: { blockers: evaluateActivationBlockers(gate).map((item) => item.code) },
    })
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        activated: false,
        blockers: evaluateActivationBlockers(gate),
        mailingAddressPresent: Boolean(settings.physicalMailingAddress),
      },
    }
  }
  const recorded = await store.recordActivation(input.actorId, store.now())
  if (!recorded) {
    await store.addAudit({
      actorType: 'staff',
      actorId: input.actorId,
      action: 'activation_already_recorded',
      entityType: 'settings',
      entityId: '1',
      payload: {},
    })
    return { ok: false, status: 409, body: { ok: false, activated: false, error: 'Activation already recorded.' } }
  }
  await store.addAudit({
    actorType: 'staff',
    actorId: input.actorId,
    action: 'activation_recorded',
    entityType: 'settings',
    entityId: '1',
    payload: { activatedAt: recorded.activatedAt },
  })
  const after = await loadAdminGate(store, input.env)
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      activated: true,
      activatedAt: recorded.activatedAt,
      liveSend: evaluateActivationBlockers(after.gate).length === 0,
      blockers: evaluateActivationBlockers(after.gate),
    },
  }
}

export async function saveOperatorSettings(
  store: OutreachStore,
  raw: Record<string, unknown>,
  actorId: string
): Promise<AdminActionResult> {
  const result = await applyOperatorSettings(store, raw, actorId)
  if (!result.ok) return { ok: false, status: 400, body: { error: result.error } }
  return { ok: true, status: 200, body: { ok: true, settings: await store.getSettings() } }
}

export async function setDatabaseKillSwitch(
  store: OutreachStore,
  enabled: boolean,
  actorId: string
): Promise<AdminActionResult> {
  const current = await store.getSettings()
  await store.updateSettings({
    killSwitch: enabled,
    settingsVersion: current.settingsVersion + 1,
  })
  const campaign = await store.getCampaignBySlug('prospect-intro')
  if (campaign) {
    await store.unapproveLatestTemplate(campaign.id, 'kill_switch_changed', actorId)
  }
  await store.addAudit({
    actorType: 'staff',
    actorId,
    action: enabled ? 'kill_switch_on' : 'kill_switch_off',
    entityType: 'settings',
    entityId: '1',
    payload: {},
  })
  return { ok: true, status: 200, body: { ok: true, killSwitch: enabled } }
}

export async function runOptOutVerification(store: OutreachStore, actorId: string): Promise<AdminActionResult> {
  const result = await verifyOptOutCapability(store, actorId)
  if (!result.ok) return { ok: false, status: 409, body: result }
  return { ok: true, status: 200, body: result }
}

export async function reconcileHistory(
  store: OutreachStore,
  raw: Record<string, unknown>,
  actorId: string
): Promise<AdminActionResult> {
  const evidence = raw.providerHistory
  if (!evidence || typeof evidence !== 'object') {
    return { ok: false, status: 400, body: { error: 'Provider history evidence is required.' } }
  }
  const result = await reconcileFromProviderEvidence(store, evidence as ProviderHistoryEvidence, actorId)
  if (!result.ok) {
    return { ok: false, status: 409, body: { ok: false, reconciled: false, remaining: result.remaining } }
  }
  return { ok: true, status: 200, body: { ok: true, reconciled: true } }
}
