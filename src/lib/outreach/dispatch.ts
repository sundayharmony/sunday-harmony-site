import { randomUUID } from 'node:crypto'
import { OUTREACH_BACKOFF_SECONDS, OUTREACH_SENDER_EMAIL } from './constants'
import { evaluateActivationBlockers, sendsPermitted, utcDayStartIso, type GateInput } from './activation'
import { resolveCompanyPresentationPdf } from './attachment'
import { claimNextPending, recoverExpiredInFlight } from './claims'
import { dispatchRecheck } from './eligibility'
import { normalizeBusinessName, normalizeEmail } from './email-address'
import { resolveOutreachProvider } from './gmail-binding'
import { lookupMx, type MxResolver } from './mx'
import { stageAfterOutboundEmail, type PipelineStage } from '@/lib/marketing-pipeline'
import { queueItemPayload, shouldAutoRetry, type OutreachMailProvider } from './provider'
import { senderConfiguredHere } from './runtime'
import type { OutreachStore } from './store'
import { ensureQueueUnsubscribeUrl, htmlHasRealUnsubscribe } from './tokens'
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

async function markNeedsReview(
  store: OutreachStore,
  item: QueueItem,
  expected: QueueItem['status'],
  reason: string,
  reviewed: string[],
  details: string[]
) {
  await store.compareAndSwap(item.id, expected, {
    status: 'needs_review',
    eligibilityReason: reason,
  })
  reviewed.push(item.id)
  details.push(reason)
}

export async function dispatchOutreachBatch(input: {
  store: OutreachStore
  provider?: OutreachMailProvider
  workerId?: string
  limit?: number
  mxResolver?: MxResolver
  attachment?: Buffer
  senderConfigured?: boolean
  schemaReady?: boolean
}): Promise<DispatchResult> {
  const store = input.store
  const at = store.now()
  const settings = await store.getSettings()
  const campaign = await store.getCampaignBySlug('prospect-intro')
  const template = campaign ? await store.getLatestTemplate(campaign.id) : null
  const senderConfigured = input.senderConfigured ?? senderConfiguredHere()
  const attachment = input.attachment ?? (await resolveCompanyPresentationPdf()) ?? undefined
  const gate: GateInput = {
    settings,
    template,
    senderConfigured,
    unsubscribeRoutePresent: true,
    schemaReady: input.schemaReady ?? Boolean(campaign && template),
    attachmentPresent: Boolean(attachment && attachment.subarray(0, 4).toString('utf8').startsWith('%PDF')),
  }
  const blockers = evaluateActivationBlockers(gate)
  const recoveredInFlight = await recoverExpiredInFlight(store, at)
  const reviewed: string[] = []
  const details: string[] = []
  const liveSendAllowed = sendsPermitted(gate)
  const provider = input.provider || resolveOutreachProvider({ liveSendAllowed })

  await store.addAudit({
    actorType: 'system',
    actorId: input.workerId || 'outreach-dispatch',
    action: 'dispatch_invoked',
    entityType: 'campaign',
    entityId: campaign?.id || null,
    payload: { blockers: blockers.map((item) => item.code), recoveredInFlight, provider: provider.name },
  })

  if (!liveSendAllowed) {
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

  const workerId = input.workerId || `worker-${randomUUID()}`
  const maxAccepted = input.limit ?? 1
  const maxClaims = Math.min(Math.max(maxAccepted * 8, maxAccepted), 80)
  let dispatched = 0
  let accepted = 0

  while (accepted < maxAccepted && dispatched < maxClaims) {
    const acceptedToday = await store.acceptedCountSince(utcDayStartIso(at))
    if (acceptedToday >= settings.dailySendLimit) {
      details.push('daily_cap')
      break
    }

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
    const suppressionAfterClaim = email ? await store.findSuppression(email) : null
    const reconciliation = await store.findReconciliationForLead({
      emailNormalized: email,
      businessNormalized: normalizeBusinessName(lead.business),
    })
    const mx = await lookupMx(email || claimed.emailNormalized, input.mxResolver)
    const recheck = dispatchRecheck({ lead, suppression: suppressionAfterClaim, reconciliation, mx })
    if (!recheck.ok) {
      const nextStatus = recheck.status === 'pending' ? 'pending' : recheck.status
      const pendingAgain = nextStatus === 'pending' || nextStatus === 'skip'
      await store.compareAndSwap(claimed.id, 'claimed', {
        status: nextStatus === 'skip' ? 'pending' : nextStatus,
        eligibilityReason: recheck.reason,
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
        ...(pendingAgain
          ? { nextAttemptAt: new Date(at.getTime() + backoffMs(claimed.attemptCount)).toISOString() }
          : {}),
      })
      details.push(recheck.reason)
      continue
    }

    const inFlightInitial = await store.compareAndSwap(claimed.id, 'claimed', {
      status: 'in_flight',
      attemptCount: claimed.attemptCount + 1,
    })
    if (!inFlightInitial) {
      details.push('lost_claim')
      continue
    }
    let inFlight = inFlightInitial
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

    let unsubscribeUrl: string
    try {
      const ensured = await ensureQueueUnsubscribeUrl(store, inFlight)
      if (!htmlHasRealUnsubscribe(ensured.item.htmlBody) || !ensured.url || /preview-disabled/.test(ensured.url)) {
        await markNeedsReview(store, inFlight, 'in_flight', 'unsubscribe_token_unusable', reviewed, details)
        continue
      }
      if (ensured.minted) {
        const saved = await store.compareAndSwap(inFlight.id, 'in_flight', {
          htmlBody: ensured.item.htmlBody,
          textBody: ensured.item.textBody,
          payloadSha256: ensured.item.payloadSha256,
        })
        if (!saved) {
          await markNeedsReview(store, inFlight, 'in_flight', 'unsubscribe_persist_conflict', reviewed, details)
          continue
        }
        inFlight = saved
      }
      unsubscribeUrl = ensured.url
    } catch {
      await markNeedsReview(store, inFlight, 'in_flight', 'unsubscribe_token_persist_failed', reviewed, details)
      continue
    }

    if (!attachment) {
      await markNeedsReview(store, inFlight, 'in_flight', 'attachment_missing', reviewed, details)
      continue
    }

    const suppressionBeforeSend = email ? await store.findSuppression(email) : null
    if (suppressionBeforeSend) {
      await store.compareAndSwap(inFlight.id, 'in_flight', {
        status: 'suppressed',
        eligibilityReason: `suppressed:${suppressionBeforeSend.reason}`,
      })
      details.push('suppressed_before_send')
      continue
    }

    const acceptedNow = await store.acceptedCountSince(utcDayStartIso(at))
    if (acceptedNow >= settings.dailySendLimit) {
      await store.compareAndSwap(inFlight.id, 'in_flight', {
        status: 'pending',
        eligibilityReason: 'daily_cap',
        claimedBy: null,
        claimedAt: null,
        leaseExpiresAt: null,
      })
      details.push('daily_cap')
      break
    }

    let result
    try {
      result = await provider.send(
        queueItemPayload(
          inFlight,
          `${settings.senderDisplayName} <${OUTREACH_SENDER_EMAIL}>`,
          unsubscribeUrl,
          attachment
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
  return dispatchOutreachBatch({ store })
}
