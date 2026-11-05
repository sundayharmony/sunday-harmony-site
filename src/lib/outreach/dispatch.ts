import { randomUUID } from 'node:crypto'
import { OUTREACH_BACKOFF_SECONDS, OUTREACH_SENDER_EMAIL } from './constants'
import { evaluateActivationBlockers, sendsPermitted } from './activation'
import { claimNextPending, recoverExpiredInFlight } from './claims'
import { dispatchRecheck } from './eligibility'
import { normalizeBusinessName, normalizeEmail } from './email-address'
import { lookupMx, type MxResolver } from './mx'
import { stageAfterOutboundEmail, type PipelineStage } from '@/lib/marketing-pipeline'
import { createDisabledProvider, queueItemPayload, shouldAutoRetry, type OutreachMailProvider } from './provider'
import { senderConfiguredHere } from './runtime'
import type { OutreachStore } from './store'
import { getPublicSiteUrl } from '@/lib/public-site-url'
import type { QueueItem } from './types'

export type DispatchResult = {
  dispatched: number
  accepted: number
  skippedDisabled: boolean
  blockers: Array<{ code: string; message: string }>
  recoveredInFlight: number
  reviewed: string[]
  details: string[]
}

function backoffMs(attemptCount: number): number {
  const seconds = OUTREACH_BACKOFF_SECONDS[Math.min(attemptCount, OUTREACH_BACKOFF_SECONDS.length - 1)]
  return seconds * 1000
}

export async function dispatchOutreachBatch(input: {
  store: OutreachStore
  provider?: OutreachMailProvider
  workerId?: string
  limit?: number
  mxResolver?: MxResolver
  attachment?: Buffer
  unsubscribeUrlFor?: (item: QueueItem) => string
  senderConfigured?: boolean
}): Promise<DispatchResult> {
  const store = input.store
  const at = store.now()
  const settings = await store.getSettings()
  const campaign = await store.getCampaignBySlug('prospect-intro')
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  const senderConfigured = input.senderConfigured ?? senderConfiguredHere()
  const blockers = evaluateActivationBlockers({
    settings,
    template,
    senderConfigured,
    unsubscribeRoutePresent: true,
  })
  const recoveredInFlight = await recoverExpiredInFlight(store, at)
  const reviewed: string[] = []
  const details: string[] = []

  await store.addAudit({
    actorType: 'system',
    actorId: input.workerId || 'outreach-dispatch',
    action: 'dispatch_invoked',
    entityType: 'campaign',
    entityId: campaign?.id || null,
    payload: { blockers: blockers.map((item) => item.code), recoveredInFlight },
  })

  if (!sendsPermitted({ settings, template, senderConfigured, unsubscribeRoutePresent: true })) {
    return {
      dispatched: 0,
      accepted: 0,
      skippedDisabled: true,
      blockers,
      recoveredInFlight,
      reviewed,
      details: ['disabled_no_send'],
    }
  }

  const provider = input.provider || createDisabledProvider()
  const workerId = input.workerId || `worker-${randomUUID()}`
  const limit = input.limit ?? 1
  let dispatched = 0
  let accepted = 0

  while (dispatched < limit) {
    const claimed = await claimNextPending(store, workerId, at)
    if (!claimed) break
    dispatched += 1

    const lead = await store.getLead(claimed.leadId)
    if (!lead) {
      await store.compareAndSwap(claimed.id, 'claimed', { status: 'ineligible', eligibilityReason: 'lead_missing' })
      details.push('lead_missing')
      continue
    }
    const email = normalizeEmail(lead.email || claimed.emailNormalized)
    const suppression = email ? await store.findSuppression(email) : null
    const reconciliation = await store.findReconciliationForLead({
      emailNormalized: email,
      businessNormalized: normalizeBusinessName(lead.business),
    })
    const mx = await lookupMx(email || claimed.emailNormalized, input.mxResolver)
    const recheck = dispatchRecheck({ lead, suppression, reconciliation, mx })
    if (!recheck.ok) {
      const nextStatus = recheck.status === 'pending' ? 'pending' : recheck.status
      await store.compareAndSwap(claimed.id, 'claimed', {
        status: nextStatus === 'skip' ? 'pending' : nextStatus,
        eligibilityReason: recheck.reason,
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      })
      details.push(recheck.reason)
      continue
    }

    const inFlight = await store.compareAndSwap(claimed.id, 'claimed', {
      status: 'in_flight',
      attemptCount: claimed.attemptCount + 1,
    })
    if (!inFlight) {
      details.push('lost_claim')
      continue
    }
    const attemptId = randomUUID()
    await store.addAttempt({
      id: attemptId,
      queueId: inFlight.id,
      attemptNumber: inFlight.attemptCount,
      provider: provider.name,
      providerIdempotencyKey: inFlight.providerIdempotencyKey,
      outcome: 'in_flight',
      retryable: false,
      providerMessageId: null,
      errorCode: null,
      errorMessage: null,
      startedAt: at.toISOString(),
      finishedAt: null,
    })

    const unsubscribeUrl =
      input.unsubscribeUrlFor?.(inFlight) || `${getPublicSiteUrl()}/unsubscribe/preview-disabled`
    let result
    try {
      result = await provider.send(
        queueItemPayload(
          inFlight,
          `${settings.senderDisplayName} <${OUTREACH_SENDER_EMAIL}>`,
          unsubscribeUrl,
          input.attachment || Buffer.from('%PDF-1.4')
        )
      )
    } catch (error) {
      result = {
        kind: 'uncertain' as const,
        reason: error instanceof Error ? error.message : 'provider_exception',
      }
    }

    if (result.kind === 'accepted') {
      const saved = await store.compareAndSwap(inFlight.id, 'in_flight', {
        status: 'accepted',
        acceptedAt: at.toISOString(),
        providerMessageId: result.providerMessageId,
        providerThreadId: result.threadId || null,
        eligibilityReason: 'provider_accepted',
      })
      if (!saved) {
        reviewed.push(inFlight.id)
        details.push('accepted_but_status_conflict')
        continue
      }
      await store.updateAttempt(attemptId, {
        outcome: 'accepted',
        providerMessageId: result.providerMessageId,
        finishedAt: at.toISOString(),
      })
      const currentStage = (lead.pipelineStage || 'researching') as PipelineStage
      const nextStage = stageAfterOutboundEmail(
        ['researching', 'ready_to_contact', 'contacted', 'responded', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost_nurture'].includes(currentStage)
          ? currentStage
          : 'researching'
      )
      await store.markLeadContacted({
        leadId: lead.id,
        contactedAt: at.toISOString(),
        pipelineStage: nextStage,
        gmailThreadId: result.threadId || lead.gmailThreadId,
      })
      await store.compareAndSwap(saved.id, 'accepted', { contactedLeadUpdatedAt: at.toISOString() })
      accepted += 1
      details.push('accepted')
      continue
    }

    if (result.kind === 'rejected' && shouldAutoRetry(result, provider) && inFlight.attemptCount < inFlight.maxAttempts) {
      await store.updateAttempt(attemptId, {
        outcome: 'rejected',
        retryable: true,
        errorCode: result.code,
        errorMessage: result.message,
        finishedAt: at.toISOString(),
      })
      await store.compareAndSwap(inFlight.id, 'in_flight', {
        status: 'pending',
        nextAttemptAt: new Date(at.getTime() + backoffMs(inFlight.attemptCount)).toISOString(),
        eligibilityReason: `retry:${result.code}`,
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      })
      details.push('scheduled_retry')
      continue
    }

    await store.updateAttempt(attemptId, {
      outcome: result.kind === 'rejected' ? 'rejected' : result.kind === 'uncertain' ? 'uncertain' : 'timeout',
      retryable: false,
      errorCode: result.kind === 'rejected' ? result.code : result.kind,
      errorMessage: result.kind === 'rejected' ? result.message : result.reason,
      finishedAt: at.toISOString(),
    })
    await store.compareAndSwap(inFlight.id, 'in_flight', {
      status: 'needs_review',
      eligibilityReason: result.kind === 'uncertain' ? result.reason : 'provider_result_not_auto_retried',
    })
    reviewed.push(inFlight.id)
    details.push('needs_review')
  }

  return {
    dispatched,
    accepted,
    skippedDisabled: false,
    blockers,
    recoveredInFlight,
    reviewed,
    details,
  }
}

export async function dispatchDisabledSafe(store: OutreachStore): Promise<DispatchResult> {
  return dispatchOutreachBatch({ store, provider: createDisabledProvider() })
}
