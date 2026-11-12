import { normalizeBusinessName, normalizeEmail, resolveLeadEmail } from './email-address'
import { extractGroundedFacts } from './facts'
import { prospectObservationIsSafe } from './greeting'
import type { MxLookupResult } from './mx'
import { mxBlocksSend } from './mx'
import type { LeadSnapshot, QueueItem, ReconciliationItem, Suppression } from './types'

export const CONTACTED_PIPELINE_STAGES = [
  'contacted',
  'responded',
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
  'won',
  'lost_nurture',
] as const

const CONTACTED_STAGES = new Set<string>(CONTACTED_PIPELINE_STAGES)
const OUTREACH_LEAD_TYPES = new Set(['marketing_lead', 'existing_client', 'completed_client'])

function outreachLeadType(lead: LeadSnapshot): string {
  return lead.leadType || 'marketing_lead'
}

/** Pipeline "Ready to contact" is the desk's source list, even if an older contact date is stored. */
export function isReadyToContactProspect(lead: LeadSnapshot): boolean {
  return lead.pipelineStage === 'ready_to_contact' && OUTREACH_LEAD_TYPES.has(outreachLeadType(lead))
}

/** Leads the ready queue may still draft. Already-contacted rows are left out. */
export function leadIsReadyQueueCandidate(lead: LeadSnapshot): boolean {
  if (!resolveLeadEmail(lead)) return false
  if (isReadyToContactProspect(lead)) return true
  if (outreachLeadType(lead) !== 'marketing_lead') return false
  if (lead.lastContactedAt) return false
  if (lead.gmailThreadId) return false
  if (lead.pipelineStage && CONTACTED_STAGES.has(lead.pipelineStage)) return false
  return true
}

export type EligibilityDecision = {
  ok: boolean
  status: QueueItem['status'] | 'skip'
  reason: string
}

export function isAlreadyContacted(lead: LeadSnapshot): boolean {
  if (lead.lastContactedAt) return true
  if (lead.gmailThreadId) return true
  if (lead.pipelineStage && CONTACTED_STAGES.has(lead.pipelineStage)) return true
  return false
}

export function evaluateEligibility(input: {
  lead: LeadSnapshot
  suppression: Suppression | null
  reconciliation: ReconciliationItem | null
  existingQueue: QueueItem | null
  mx: MxLookupResult | null
}): EligibilityDecision {
  const readyToContact = isReadyToContactProspect(input.lead)
  const leadType = input.lead.leadType || 'marketing_lead'
  if (!readyToContact && leadType !== 'marketing_lead') {
    return { ok: false, status: 'ineligible', reason: 'not_marketing_lead' }
  }
  const email = normalizeEmail(input.lead.email || '')
  if (!email) {
    return { ok: false, status: 'ineligible', reason: 'invalid_or_missing_email' }
  }
  const facts = extractGroundedFacts({
    business: input.lead.business,
    first_name: input.lead.firstName,
    location_text: input.lead.locationText,
    industry: input.lead.industry,
    marketing_opportunity: input.lead.marketingOpportunity,
    recommended_service: input.lead.recommendedService,
    website: input.lead.website,
  })
  if (!facts) {
    return { ok: false, status: 'ineligible', reason: 'missing_business' }
  }
  if (!prospectObservationIsSafe(facts.observation)) {
    return {
      ok: false,
      status: 'blocked_review',
      reason: 'observation_internal_notes',
    }
  }
  if (input.existingQueue) {
    if (input.existingQueue.status === 'accepted' || input.existingQueue.status === 'delivered') {
      return { ok: false, status: 'skip', reason: 'already_sent' }
    }
    if (input.existingQueue.status === 'in_flight' || input.existingQueue.status === 'claimed') {
      return { ok: false, status: 'skip', reason: 'send_in_progress' }
    }
    if (input.existingQueue.status === 'needs_review' || input.existingQueue.status === 'blocked_review') {
      return { ok: false, status: 'skip', reason: input.existingQueue.status }
    }
    return { ok: false, status: 'skip', reason: `already_queued:${input.existingQueue.status}` }
  }
  if (input.suppression && input.suppression.emailNormalized === email) {
    return { ok: false, status: 'suppressed', reason: `suppressed:${input.suppression.reason}` }
  }
  if (!readyToContact && isAlreadyContacted(input.lead)) {
    return { ok: false, status: 'ineligible', reason: 'already_contacted' }
  }
  if (input.reconciliation && input.reconciliation.treatment === 'block_review') {
    return { ok: false, status: 'blocked_review', reason: `unverified_report:${input.reconciliation.outcome}` }
  }
  if (input.mx) {
    if (input.mx.kind === 'uncertain') {
      return { ok: true, status: 'pending', reason: 'mx_uncertain_deferred' }
    }
    if (mxBlocksSend(input.mx)) {
      return { ok: false, status: 'ineligible', reason: input.mx.kind === 'null_mx' ? 'null_mx' : 'no_mx' }
    }
  }
  return { ok: true, status: 'pending', reason: 'eligible' }
}

export function dispatchRecheck(input: {
  lead: LeadSnapshot
  suppression: Suppression | null
  reconciliation: ReconciliationItem | null
  mx: MxLookupResult
}): EligibilityDecision {
  const email = normalizeEmail(input.lead.email || '')
  if (!email) return { ok: false, status: 'ineligible', reason: 'invalid_or_missing_email' }
  if (input.suppression && email && input.suppression.emailNormalized === email) {
    return { ok: false, status: 'suppressed', reason: `suppressed:${input.suppression.reason}` }
  }
  if (!isReadyToContactProspect(input.lead) && isAlreadyContacted(input.lead)) {
    return { ok: false, status: 'ineligible', reason: 'already_contacted' }
  }
  if (input.reconciliation && input.reconciliation.treatment === 'block_review') {
    return { ok: false, status: 'blocked_review', reason: `unverified_report:${input.reconciliation.outcome}` }
  }
  if (input.mx.kind === 'uncertain') {
    return { ok: false, status: 'pending', reason: 'mx_uncertain' }
  }
  if (mxBlocksSend(input.mx)) {
    return { ok: false, status: 'ineligible', reason: input.mx.kind === 'null_mx' ? 'null_mx' : 'no_mx' }
  }
  return { ok: true, status: 'pending', reason: 'eligible' }
}

export function leadBusinessKey(lead: LeadSnapshot): string {
  return normalizeBusinessName(lead.business)
}
