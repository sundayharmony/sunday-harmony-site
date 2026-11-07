import { randomUUID } from 'node:crypto'
import { OUTREACH_ATTACHMENT_FILENAME, OUTREACH_CAMPAIGN_SLUG, OUTREACH_MAX_ATTEMPTS } from './constants'
import { payloadSha256, renderDraft } from './draft'
import { evaluateEligibility } from './eligibility'
import { normalizeBusinessName, normalizeEmail } from './email-address'
import { extractGroundedFacts } from './facts'
import { prospectObservationIsSafe } from './greeting'
import { lookupMx, type MxResolver } from './mx'
import type { OutreachStore } from './store'
import { newIdempotencyKey } from './store'
import { extractUnsubscribeUrl } from './tokens'
import { createUnsubscribeToken, hashUnsubscribeToken, unsubscribeUrl } from './unsubscribe'
import type { LeadSnapshot, QueueItem } from './types'

export type EnqueueResult = {
  enqueued: number
  blockedReview: number
  ineligible: number
  skipped: number
  reasons: Record<string, number>
}

function bump(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] || 0) + 1
}

export async function enqueueLeadSnapshots(
  store: OutreachStore,
  leads: LeadSnapshot[],
  options?: { mxResolver?: MxResolver; actor?: string }
): Promise<EnqueueResult> {
  const campaign = await store.getCampaignBySlug(OUTREACH_CAMPAIGN_SLUG)
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  const settings = await store.getSettings()
  const result: EnqueueResult = {
    enqueued: 0,
    blockedReview: 0,
    ineligible: 0,
    skipped: 0,
    reasons: {},
  }
  if (!campaign || !template) {
    bump(result.reasons, 'campaign_missing')
    return result
  }

  for (const lead of leads) {
    const emailNorm = normalizeEmail(lead.email || '')
    const existing = emailNorm
      ? (await store.findQueueByLead(campaign.id, lead.id)) ||
        (await store.findQueueByEmail(campaign.id, emailNorm))
      : await store.findQueueByLead(campaign.id, lead.id)
    const suppression = emailNorm ? await store.findSuppression(emailNorm) : null
    const reconciliation = await store.findReconciliationForLead({
      emailNormalized: emailNorm,
      businessNormalized: normalizeBusinessName(lead.business),
    })
    const mx = emailNorm
      ? options?.mxResolver
        ? await lookupMx(emailNorm, options.mxResolver)
        : { kind: 'uncertain' as const, reason: 'mx_deferred_until_dispatch' }
      : null
    const decision = evaluateEligibility({
      lead,
      suppression,
      reconciliation,
      existingQueue: existing,
      mx,
    })
    bump(result.reasons, decision.reason)
    if (decision.status === 'skip') {
      result.skipped += 1
      continue
    }
    if (existing && !decision.ok) {
      result.skipped += 1
      continue
    }
    const facts = extractGroundedFacts({
      business: lead.business,
      first_name: lead.firstName,
      location_text: lead.locationText,
      industry: lead.industry,
      marketing_opportunity: lead.marketingOpportunity,
      recommended_service: lead.recommendedService,
      website: lead.website,
    })
    if (!facts || !emailNorm || !lead.email) {
      result.ineligible += 1
      continue
    }
    const token = createUnsubscribeToken()
    const tokenHash = hashUnsubscribeToken(token)
    const unsub = unsubscribeUrl(token)
    const draft = renderDraft({
      facts,
      unsubscribeUrl: unsub,
      physicalMailingAddress: settings.physicalMailingAddress,
    })
    const id = randomUUID()
    const now = store.now().toISOString()
    const item: QueueItem = {
      id,
      campaignId: campaign.id,
      templateVersionId: template.id,
      leadId: lead.id,
      emailRaw: lead.email.trim(),
      emailNormalized: emailNorm,
      status: decision.ok ? 'pending' : decision.status,
      eligibilityReason: decision.reason,
      groundedFacts: facts,
      subject: draft.subject,
      preheader: draft.preheader,
      htmlBody: draft.html,
      textBody: draft.text,
      payloadSha256: payloadSha256({
        subject: draft.subject,
        html: draft.html,
        text: draft.text,
        to: emailNorm,
      }),
      providerIdempotencyKey: newIdempotencyKey(id),
      providerMessageId: null,
      providerThreadId: null,
      attemptCount: 0,
      maxAttempts: settings.maxAttempts || OUTREACH_MAX_ATTEMPTS,
      nextAttemptAt: now,
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
      acceptedAt: null,
      deliveredAt: null,
      bouncedAt: null,
      contactedLeadUpdatedAt: null,
      attachmentFilename: OUTREACH_ATTACHMENT_FILENAME,
      createdAt: now,
      updatedAt: now,
    }
    const inserted = await store.insertQueue(item)
    if (!inserted.ok) {
      result.skipped += 1
      bump(result.reasons, 'duplicate')
      continue
    }
    await store.putUnsubscribeToken({
      tokenHash,
      emailNormalized: emailNorm,
      leadId: lead.id,
      queueId: item.id,
    })
    await store.addAudit({
      actorType: 'system',
      actorId: options?.actor || 'outreach-enqueue',
      action: decision.ok ? 'enqueued' : 'enqueued_blocked',
      entityType: 'queue',
      entityId: item.id,
      payload: { reason: decision.reason, leadId: lead.id, email: emailNorm },
    })
    if (decision.ok) result.enqueued += 1
    else if (decision.status === 'blocked_review') result.blockedReview += 1
    else result.ineligible += 1
  }
  return result
}

export async function enqueueFromStoreCandidates(
  store: OutreachStore,
  options?: { mxResolver?: MxResolver; actor?: string }
): Promise<EnqueueResult> {
  await refreshUnsentQueueCopy(store)
  const leads = await store.listEligibleLeadCandidates()
  return enqueueLeadSnapshots(store, leads, options)
}

const COPY_REFRESH_STATUSES = new Set(['pending', 'needs_review', 'blocked_review'])
const COPY_HOLD_REASONS = new Set([
  'unusable_greeting',
  'missing_first_name',
  'observation_contains_email',
  'observation_internal_notes',
])

export function nextQueueStateAfterCopyRefresh(item: QueueItem): {
  status: QueueItem['status']
  eligibilityReason: string
} {
  if (item.eligibilityReason === 'held_for_internal_test') {
    return { status: 'pending', eligibilityReason: 'held_for_internal_test' }
  }
  const nextAt = Date.parse(item.nextAttemptAt)
  if (Number.isFinite(nextAt) && nextAt - Date.now() > 7 * 24 * 60 * 60 * 1000) {
    return { status: 'pending', eligibilityReason: 'held_for_internal_test' }
  }
  if (item.status === 'pending') {
    return { status: 'pending', eligibilityReason: item.eligibilityReason }
  }
  if (COPY_HOLD_REASONS.has(item.eligibilityReason)) {
    return { status: 'pending', eligibilityReason: 'eligible' }
  }
  return { status: item.status, eligibilityReason: item.eligibilityReason }
}

export async function refreshUnsentQueueCopy(store: OutreachStore): Promise<{
  refreshed: number
  skipped: number
}> {
  const settings = await store.getSettings()
  const items = await store.listQueue()
  let refreshed = 0
  let skipped = 0
  for (const item of items) {
    if (!COPY_REFRESH_STATUSES.has(item.status)) {
      skipped += 1
      continue
    }
    if (item.eligibilityReason.startsWith('unverified_report')) {
      skipped += 1
      continue
    }
    const lead = await store.getLead(item.leadId)
    if (!lead) {
      skipped += 1
      continue
    }
    const facts = extractGroundedFacts({
      business: lead.business,
      first_name: lead.firstName,
      location_text: lead.locationText,
      industry: lead.industry,
      marketing_opportunity: lead.marketingOpportunity,
      recommended_service: lead.recommendedService,
      website: lead.website,
    })
    if (!facts || !prospectObservationIsSafe(facts.observation)) {
      skipped += 1
      continue
    }
    const unsub = extractUnsubscribeUrl(item.htmlBody) || extractUnsubscribeUrl(item.textBody)
    if (!unsub) {
      skipped += 1
      continue
    }
    const draft = renderDraft({
      facts,
      unsubscribeUrl: unsub,
      physicalMailingAddress: settings.physicalMailingAddress,
    })
    const next = nextQueueStateAfterCopyRefresh(item)
    const saved = await store.compareAndSwap(item.id, item.status, {
      groundedFacts: facts,
      subject: draft.subject,
      preheader: draft.preheader,
      htmlBody: draft.html,
      textBody: draft.text,
      payloadSha256: payloadSha256({
        subject: draft.subject,
        html: draft.html,
        text: draft.text,
        to: item.emailNormalized,
      }),
      status: next.status,
      eligibilityReason: next.eligibilityReason,
    })
    if (saved) refreshed += 1
    else skipped += 1
  }
  return { refreshed, skipped }
}

export function leadRowToSnapshot(row: Record<string, unknown>): LeadSnapshot | null {
  const id = typeof row.id === 'string' ? row.id : ''
  const business = typeof row.business === 'string' ? row.business : ''
  if (!id || !business) return null
  return {
    id,
    firstName: typeof row.first_name === 'string' ? row.first_name : null,
    lastName: typeof row.last_name === 'string' ? row.last_name : null,
    business,
    email: typeof row.email === 'string' ? row.email : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    website: typeof row.website === 'string' ? row.website : null,
    locationText: typeof row.location_text === 'string' ? row.location_text : null,
    industry: typeof row.industry === 'string' ? row.industry : null,
    marketingOpportunity: typeof row.marketing_opportunity === 'string' ? row.marketing_opportunity : null,
    recommendedService: typeof row.recommended_service === 'string' ? row.recommended_service : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    pipelineStage: typeof row.pipeline_stage === 'string' ? row.pipeline_stage : null,
    lastContactedAt: typeof row.last_contacted_at === 'string' ? row.last_contacted_at : null,
    gmailThreadId: typeof row.gmail_thread_id === 'string' ? row.gmail_thread_id : null,
    source: typeof row.source === 'string' ? row.source : null,
    leadType: typeof row.lead_type === 'string' ? row.lead_type : 'marketing_lead',
  }
}
