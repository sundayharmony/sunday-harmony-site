import type { GroundedFacts } from './facts'

export type QueueStatus =
  | 'pending'
  | 'claimed'
  | 'in_flight'
  | 'accepted'
  | 'delivered'
  | 'bounced'
  | 'needs_review'
  | 'suppressed'
  | 'ineligible'
  | 'blocked_review'
  | 'cancelled'
  | 'failed'

export type DeliveryState = 'not_sent' | 'accepted' | 'delivered' | 'bounced' | 'uncertain'

export type HistoryReconciliationStatus = 'unknown' | 'unverified_reports_loaded' | 'reconciled'

export type AttemptOutcome =
  | 'in_flight'
  | 'accepted'
  | 'rejected'
  | 'timeout'
  | 'uncertain'
  | 'skipped_disabled'
  | 'skipped_kill_switch'
  | 'skipped_gates'

export type OutreachSettings = {
  id: 1
  killSwitch: boolean
  activatedAt: string | null
  activationApprovedBy: string | null
  physicalMailingAddress: string | null
  senderEmail: string
  senderDisplayName: string
  signerName: string
  companyName: string
  ctaLabel: string
  ctaUrl: string
  dailySendLimit: number
  maxAttempts: number
  historyReconciliationStatus: HistoryReconciliationStatus
  providerHistoryVerifiedAt: string | null
  optOutVerifiedAt: string | null
  settingsVersion: number
}

export type OutreachCampaign = {
  id: string
  slug: string
  name: string
}

export type OutreachTemplateVersion = {
  id: string
  campaignId: string
  version: number
  subjectTemplate: string
  preheaderTemplate: string
  contentSha256: string
  approved: boolean
  approvedAt: string | null
  approvedBy: string | null
  approvedSettingsVersion: number | null
}

export type Suppression = {
  id: string
  emailNormalized: string
  reason: 'unsubscribe' | 'complaint' | 'hard_bounce' | 'operator' | 'already_contacted' | 'already_sent'
  source: 'user' | 'provider' | 'operator' | 'system'
  confirmationStatus: 'confirmed' | 'unverified_report'
  notes: string
  createdAt: string
}

export type ReconciliationItem = {
  id: string
  business: string
  businessNormalized: string
  email: string | null
  emailNormalized: string | null
  outcome: 'sent' | 'null_mx' | 'bounce_550' | 'other'
  reportedOn: string | null
  matchMethod: 'none' | 'exact_email' | 'exact_business'
  treatment: 'block_review' | 'ignore'
  providerConfirmed: boolean
  notes: string
}

export type QueueItem = {
  id: string
  campaignId: string
  templateVersionId: string
  leadId: string
  emailRaw: string
  emailNormalized: string
  status: QueueStatus
  eligibilityReason: string
  groundedFacts: GroundedFacts
  subject: string
  preheader: string
  htmlBody: string
  textBody: string
  payloadSha256: string
  providerIdempotencyKey: string
  providerMessageId: string | null
  providerThreadId: string | null
  attemptCount: number
  maxAttempts: number
  nextAttemptAt: string
  claimedBy: string | null
  claimedAt: string | null
  leaseExpiresAt: string | null
  acceptedAt: string | null
  deliveredAt: string | null
  bouncedAt: string | null
  contactedLeadUpdatedAt: string | null
  attachmentFilename: string
  createdAt: string
  updatedAt: string
}

export type OutreachAttempt = {
  id: string
  queueId: string
  attemptNumber: number
  provider: string
  providerIdempotencyKey: string
  outcome: AttemptOutcome
  retryable: boolean
  providerMessageId: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string
  finishedAt: string | null
}

export type AuditEvent = {
  id: string
  actorType: 'system' | 'staff' | 'public' | 'provider'
  actorId: string | null
  action: string
  entityType: string
  entityId: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export type LeadSnapshot = {
  id: string
  firstName?: string | null
  lastName?: string | null
  business: string
  email?: string | null
  phone?: string | null
  website?: string | null
  locationText?: string | null
  industry?: string | null
  marketingOpportunity?: string | null
  recommendedService?: string | null
  notes?: string | null
  pipelineStage?: string | null
  lastContactedAt?: string | null
  gmailThreadId?: string | null
  source?: string | null
  leadType?: string | null
}

export type BookingSnapshot = {
  status: 'scheduled' | 'cancelled' | 'none'
  startsAt: string | null
  meetLink: string | null
}

export function deliveryStateFor(item: Pick<QueueItem, 'status' | 'acceptedAt' | 'deliveredAt' | 'bouncedAt'>): DeliveryState {
  if (item.status === 'delivered' || item.deliveredAt) return 'delivered'
  if (item.status === 'bounced' || item.bouncedAt) return 'bounced'
  if (item.status === 'needs_review') return 'uncertain'
  if (item.status === 'accepted' || item.acceptedAt) return 'accepted'
  return 'not_sent'
}
