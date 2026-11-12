import { randomUUID } from 'node:crypto'
import {
  OUTREACH_ATTACHMENT_FILENAME,
  OUTREACH_CAMPAIGN_SLUG,
  OUTREACH_ENQUEUE_EXAMINE_CAP,
  OUTREACH_MAX_ATTEMPTS,
  OUTREACH_READY_QUEUE_SIZE,
} from './constants'
import { payloadSha256, renderDraft } from './draft'
import { evaluateEligibility, leadIsReadyQueueCandidate } from './eligibility'
import { normalizeBusinessName, normalizeEmail } from './email-address'
import { extractGroundedFacts } from './facts'
import { prospectObservationIsSafe } from './greeting'
import { lookupMx, type MxResolver } from './mx'
import type { OutreachStore } from './store'
import { newIdempotencyKey } from './store'
import { ensureQueueUnsubscribeUrl, extractUnsubscribeUrl } from './tokens'
import { createUnsubscribeToken, hashUnsubscribeToken, unsubscribeUrl } from './unsubscribe'
import type { LeadSnapshot, QueueItem } from './types'

export type EnqueueResult = {
  enqueued: number
  blockedReview: number
  ineligible: number
  skipped: number
  reasons: Record<string, number>
  /** Soft retry backoff rows released for the desk (ensureReadyQueue only). */
  released: number
  /** Soft needs_review / expired claim rows returned to pending (ensureReadyQueue only). */
  recovered: number
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
    released: 0,
    recovered: 0,
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

function emptyEnqueueResult(): EnqueueResult {
  return {
    enqueued: 0,
    blockedReview: 0,
    ineligible: 0,
    skipped: 0,
    reasons: {},
    released: 0,
    recovered: 0,
  }
}

function mergeEnqueueResults(into: EnqueueResult, from: EnqueueResult) {
  into.enqueued += from.enqueued
  into.blockedReview += from.blockedReview
  into.ineligible += from.ineligible
  into.skipped += from.skipped
  into.released += from.released
  into.recovered += from.recovered
  for (const [reason, count] of Object.entries(from.reasons)) {
    into.reasons[reason] = (into.reasons[reason] || 0) + count
  }
}

export function compareQueueOrder(
  a: Pick<QueueItem, 'id' | 'nextAttemptAt' | 'createdAt'>,
  b: Pick<QueueItem, 'id' | 'nextAttemptAt' | 'createdAt'>
): number {
  const aKey = a.nextAttemptAt || a.createdAt
  const bKey = b.nextAttemptAt || b.createdAt
  return aKey.localeCompare(bKey) || a.id.localeCompare(b.id)
}

export function isSentQueueStatus(status: QueueItem['status']): boolean {
  return status === 'accepted' || status === 'delivered' || status === 'bounced'
}

/** Pending letter that cron/workers can claim right now (not waiting on retry backoff). */
export function isClaimablePending(
  item: Pick<QueueItem, 'status' | 'nextAttemptAt'>,
  at: Date = new Date()
): boolean {
  if (item.status !== 'pending') return false
  const nextAt = Date.parse(item.nextAttemptAt)
  if (!Number.isFinite(nextAt)) return true
  return nextAt <= at.getTime()
}

/**
 * Manual desk Send uses ignoreBackoff, so any pending letter that is not an
 * intentional long hold counts toward the ready target and preview.
 */
export function isDeskReadyPending(
  item: Pick<QueueItem, 'status' | 'nextAttemptAt' | 'eligibilityReason'>,
  at: Date = new Date()
): boolean {
  if (item.status !== 'pending') return false
  if (item.eligibilityReason === 'held_for_internal_test') return false
  const nextAt = Date.parse(item.nextAttemptAt)
  if (Number.isFinite(nextAt) && nextAt - at.getTime() > 7 * 24 * 60 * 60 * 1000) return false
  return true
}

export async function pendingReadyCount(store: OutreachStore, at?: Date): Promise<number> {
  const when = at ?? store.now()
  const queue = await store.listQueueSummaries({
    statuses: ['pending'],
    order: 'queue',
    limit: Math.max(OUTREACH_READY_QUEUE_SIZE * 5, 50),
  })
  return queue.filter((item) => isDeskReadyPending(item, when)).length
}

export async function pendingDeferredCount(store: OutreachStore, at?: Date): Promise<number> {
  const when = at ?? store.now()
  const queue = await store.listQueueSummaries({
    statuses: ['pending'],
    order: 'queue',
    limit: Math.max(OUTREACH_READY_QUEUE_SIZE * 5, 50),
  })
  return queue.filter((item) => !isClaimablePending(item, when) && isDeskReadyPending(item, when)).length
}

function leadNeedsNoDraft(lead: LeadSnapshot): boolean {
  return !leadIsReadyQueueCandidate(lead)
}

const DESK_RECOVERABLE_REVIEW_REASONS = new Set([
  'mx_uncertain',
  'mx_uncertain_deferred',
  'unusable_greeting',
  'missing_first_name',
  'observation_contains_email',
  'observation_internal_notes',
  'uncertain_after_inflight_timeout',
  'unsubscribe_token_unusable',
  'unsubscribe_persist_conflict',
  'gmail_insufficient_scopes',
])

function isDeskRecoverableReason(reason: string): boolean {
  if (!reason) return false
  if (DESK_RECOVERABLE_REVIEW_REASONS.has(reason)) return true
  if (reason.startsWith('retry:')) return true
  if (reason.startsWith('gmail_')) return true
  return false
}

/**
 * Soft MX / send retries set nextAttemptAt in the future, so the desk showed
 * "0 ready · N waiting on retry" with nothing claimable. Release those for the
 * operator desk (not intentional holds like held_for_internal_test).
 */
export async function releaseSoftRetryBackoff(
  store: OutreachStore,
  options?: { limit?: number; at?: Date }
): Promise<number> {
  const at = options?.at ?? store.now()
  const limit = options?.limit ?? OUTREACH_READY_QUEUE_SIZE
  const pending = await store.listQueueSummaries({
    statuses: ['pending'],
    order: 'queue',
    limit: Math.max(limit * 3, 30),
  })
  let released = 0
  for (const item of pending) {
    if (released >= limit) break
    if (isClaimablePending(item, at)) continue
    if (item.eligibilityReason === 'held_for_internal_test') continue
    const saved = await store.compareAndSwap(item.id, 'pending', {
      nextAttemptAt: at.toISOString(),
      eligibilityReason:
        item.eligibilityReason.startsWith('retry:') || item.eligibilityReason === 'mx_uncertain'
          ? 'eligible'
          : item.eligibilityReason,
    })
    if (saved) released += 1
  }
  return released
}

/**
 * Pull soft-failed letters back into pending so the desk is not stuck at
 * "0 ready" while needs_review / expired claims still hold the lead keys.
 */
export async function recoverStuckQueueForDesk(
  store: OutreachStore,
  options?: { limit?: number; at?: Date }
): Promise<{ released: number; recovered: number }> {
  const at = options?.at ?? store.now()
  const limit = options?.limit ?? OUTREACH_READY_QUEUE_SIZE
  const released = await releaseSoftRetryBackoff(store, { limit, at })
  let recovered = 0

  const reviewRows = await store.listQueueSummaries({
    statuses: ['needs_review'],
    order: 'queue',
    limit: Math.max(limit * 3, 30),
  })
  for (const item of reviewRows) {
    if (recovered >= limit) break
    if (!isDeskRecoverableReason(item.eligibilityReason)) continue
    const saved = await store.compareAndSwap(item.id, 'needs_review', {
      status: 'pending',
      eligibilityReason: 'eligible',
      nextAttemptAt: at.toISOString(),
      claimedBy: null,
      claimedAt: null,
      leaseExpiresAt: null,
    })
    if (saved) recovered += 1
  }

  if (recovered < limit) {
    const claimedRows = await store.listQueueSummaries({
      statuses: ['claimed'],
      order: 'queue',
      limit: 30,
    })
    for (const item of claimedRows) {
      if (recovered >= limit) break
      const leaseMs = Date.parse(item.leaseExpiresAt || '')
      if (Number.isFinite(leaseMs) && leaseMs > at.getTime()) continue
      const saved = await store.compareAndSwap(item.id, 'claimed', {
        status: 'pending',
        eligibilityReason: 'eligible',
        nextAttemptAt: at.toISOString(),
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      })
      if (saved) recovered += 1
    }
  }

  return { released, recovered }
}

const PROMOTABLE_HOLD_REASONS = new Set([
  'observation_internal_notes',
  'unusable_greeting',
  'missing_first_name',
  'observation_contains_email',
  'mx_uncertain',
  'mx_uncertain_deferred',
  'already_contacted',
  'not_marketing_lead',
  'invalid_or_missing_email',
])

function holdReasonCanBecomeReady(reason: string): boolean {
  if (PROMOTABLE_HOLD_REASONS.has(reason)) return true
  if (reason.startsWith('retry:')) return true
  if (reason.startsWith('gmail_')) return true
  return false
}

/**
 * Letters parked as blocked or in review still belong to those leads, so a new
 * draft is skipped. When the copy is safe now, put the existing letter back in
 * the ready queue instead of leaving the desk at zero.
 */
export async function promoteHeldLetters(store: OutreachStore, limit: number): Promise<number> {
  if (limit < 1) return 0
  const settings = await store.getSettings()
  const now = store.now().toISOString()
  let promoted = 0
  const pageSize = 100
  const statuses: Array<QueueItem['status']> = ['blocked_review', 'needs_review', 'ineligible']
  for (const status of statuses) {
    for (let offset = 0; offset < 500 && promoted < limit; offset += pageSize) {
      const rows = await store.listQueueSummaries({
        statuses: [status],
        order: 'queue',
        limit: pageSize,
        offset,
      })
      if (rows.length === 0) break
      for (const summary of rows) {
        if (promoted >= limit) break
        if (!holdReasonCanBecomeReady(summary.eligibilityReason)) continue
        const item = await store.getQueueItem(summary.id)
        if (!item || item.status !== status) continue
        const lead = await store.getLead(item.leadId)
        if (!lead || leadNeedsNoDraft(lead)) continue
        const emailNorm = normalizeEmail(lead.email || item.emailNormalized)
        const suppression = emailNorm ? await store.findSuppression(emailNorm) : null
        const reconciliation = await store.findReconciliationForLead({
          emailNormalized: emailNorm,
          businessNormalized: normalizeBusinessName(lead.business),
        })
        const decision = evaluateEligibility({
          lead,
          suppression,
          reconciliation,
          existingQueue: null,
          mx: { kind: 'uncertain', reason: 'mx_deferred_until_dispatch' },
        })
        if (!decision.ok) continue
        const facts = extractGroundedFacts({
          business: lead.business,
          first_name: lead.firstName,
          location_text: lead.locationText,
          industry: lead.industry,
          marketing_opportunity: lead.marketingOpportunity,
          recommended_service: lead.recommendedService,
          website: lead.website,
        })
        if (!facts || !prospectObservationIsSafe(facts.observation)) continue
        let unsub = extractUnsubscribeUrl(item.htmlBody) || extractUnsubscribeUrl(item.textBody)
        if (!unsub) {
          const minted = await ensureQueueUnsubscribeUrl(store, item)
          unsub = minted.url
        }
        const draft = renderDraft({
          facts,
          unsubscribeUrl: unsub,
          physicalMailingAddress: settings.physicalMailingAddress,
        })
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
          status: 'pending',
          eligibilityReason: 'eligible',
          nextAttemptAt: now,
          claimedBy: null,
          claimedAt: null,
          leaseExpiresAt: null,
        })
        if (saved) promoted += 1
      }
      if (rows.length < pageSize) break
    }
  }
  return promoted
}

const CANDIDATE_PAGE_SIZE = 100
/** Stop a refill that keeps receiving the same page. Skipped rows do not count as drafts. */
const CANDIDATE_SCAN_LIMIT = 20000

export async function ensureReadyQueue(
  store: OutreachStore,
  options?: {
    mxResolver?: MxResolver
    actor?: string
    size?: number
    /** New leads this call may draft. Already-queued and already-contacted rows do not count. */
    maxCandidates?: number
    /** How many unsent letters to rewrite before looking for new leads. */
    refreshLimit?: number
    /** When false, leave retry backoff alone (cron/tests). Desk defaults to releasing. */
    releaseSoftRetries?: boolean
    /** When false, skip reclaiming soft needs_review / expired claims. */
    recoverStuck?: boolean
  }
): Promise<EnqueueResult> {
  const size = options?.size ?? OUTREACH_READY_QUEUE_SIZE
  const maxCandidates = options?.maxCandidates ?? OUTREACH_ENQUEUE_EXAMINE_CAP
  const refreshWindow = options?.refreshLimit ?? size
  let released = 0
  let recovered = 0
  if (options?.releaseSoftRetries === false && options?.recoverStuck !== true) {
    // Cron/tests can leave backoff and soft review holds alone.
  } else if (options?.recoverStuck === false) {
    released = await releaseSoftRetryBackoff(store, { limit: size })
  } else {
    const stuck = await recoverStuckQueueForDesk(store, { limit: size })
    released = stuck.released
    recovered = stuck.recovered
  }
  await refreshReadyQueueCopy(
    store,
    refreshWindow,
    options?.refreshLimit != null ? ['pending'] : undefined
  )
  const result = emptyEnqueueResult()
  result.released = released
  result.recovered = recovered
  let claimable = await pendingReadyCount(store)
  if (claimable < size) {
    const promoted = await promoteHeldLetters(store, size - claimable)
    result.recovered += promoted
    if (promoted > 0) claimable = await pendingReadyCount(store)
  }
  if (claimable >= size || maxCandidates < 1) return result

  const queued = await store.listQueuedLeadKeys()
  const queuedLeadIds = new Set(queued.map((item) => item.leadId))
  const queuedEmails = new Set(queued.map((item) => item.emailNormalized).filter(Boolean))
  let examined = 0
  let offset = 0

  while (claimable < size && examined < maxCandidates && offset < CANDIDATE_SCAN_LIMIT) {
    const page = await store.listEligibleLeadCandidates({
      untouched: true,
      limit: CANDIDATE_PAGE_SIZE,
      offset,
    })
    if (page.length === 0) break
    for (const lead of page) {
      if (claimable >= size || examined >= maxCandidates) break
      const emailNorm = normalizeEmail(lead.email || '')
      if (!emailNorm) {
        result.ineligible += 1
        bump(result.reasons, 'invalid_or_missing_email')
        continue
      }
      if (leadNeedsNoDraft(lead) || queuedLeadIds.has(lead.id) || queuedEmails.has(emailNorm)) {
        continue
      }
      examined += 1
      const one = await enqueueLeadSnapshots(store, [lead], options)
      mergeEnqueueResults(result, one)
      const draftedOrHeld = one.enqueued + one.ineligible + one.blockedReview
      if (draftedOrHeld === 0) examined -= 1
      claimable += one.enqueued
      queuedLeadIds.add(lead.id)
      if (emailNorm) queuedEmails.add(emailNorm)
    }
    offset += page.length
    if (page.length < CANDIDATE_PAGE_SIZE) break
  }
  return result
}

export async function enqueueFromStoreCandidates(
  store: OutreachStore,
  options?: { mxResolver?: MxResolver; actor?: string }
): Promise<EnqueueResult> {
  return ensureReadyQueue(store, options)
}

const COPY_REFRESH_STATUSES = new Set<QueueItem['status']>(['pending', 'needs_review', 'blocked_review'])
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

export async function refreshReadyQueueCopy(
  store: OutreachStore,
  size = OUTREACH_READY_QUEUE_SIZE,
  statuses?: Array<QueueItem['status']>
): Promise<{ refreshed: number; skipped: number }> {
  const summaries = await store.listQueueSummaries({
    statuses: statuses ?? [...COPY_REFRESH_STATUSES],
    order: 'queue',
    limit: size,
  })
  const ids = summaries.map((item) => item.id)
  const items: QueueItem[] = []
  for (const id of ids) {
    const item = await store.getQueueItem(id)
    if (item) items.push(item)
  }
  return refreshUnsentQueueCopy(store, items)
}

export async function refreshUnsentQueueCopy(
  store: OutreachStore,
  items?: QueueItem[]
): Promise<{
  refreshed: number
  skipped: number
}> {
  const settings = await store.getSettings()
  const list = items ?? (await store.listQueue())
  let refreshed = 0
  let skipped = 0
  for (const item of list) {
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
    const digest = payloadSha256({
      subject: draft.subject,
      html: draft.html,
      text: draft.text,
      to: item.emailNormalized,
    })
    const storedDigest = payloadSha256({
      subject: item.subject,
      html: item.htmlBody,
      text: item.textBody,
      to: item.emailNormalized,
    })
    if (
      digest === storedDigest &&
      next.status === item.status &&
      next.eligibilityReason === item.eligibilityReason &&
      JSON.stringify(facts) === JSON.stringify(item.groundedFacts)
    ) {
      skipped += 1
      continue
    }
    const saved = await store.compareAndSwap(item.id, item.status, {
      groundedFacts: facts,
      subject: draft.subject,
      preheader: draft.preheader,
      htmlBody: draft.html,
      textBody: draft.text,
      payloadSha256: digest,
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
