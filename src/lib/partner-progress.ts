import { STATUS_STRIP_LABELS, type ApplicationStatus } from '@/lib/credit-funding-types'
import { maskApplicantName } from '@/lib/referrals'

const CLOSED = new Set(['declined', 'archived'])

export type PartnerReferralProgress = {
  id: string
  date: string
  applicant: string
  stage: string
  updatedAt: string
  disputeRound: number | null
  bucket: 'in_progress' | 'completed' | 'closed'
}

export function partnerProgressBucket(status: string): PartnerReferralProgress['bucket'] {
  if (status === 'completed') return 'completed'
  if (CLOSED.has(status)) return 'closed'
  return 'in_progress'
}

export function partnerStageLabel(status: string): string {
  if (status in STATUS_STRIP_LABELS) return STATUS_STRIP_LABELS[status as ApplicationStatus]
  return status.replace(/_/g, ' ')
}

/** Privacy-safe row for a partner. Callers must not pass emails, scores, or documents. */
export function toPartnerReferralProgress(input: {
  id: string
  date: string
  fullName: string
  status: string
  updatedAt: string
  disputeRound: number | null
}): PartnerReferralProgress {
  return {
    id: input.id,
    date: input.date,
    applicant: maskApplicantName(input.fullName),
    stage: partnerStageLabel(input.status),
    updatedAt: input.updatedAt,
    disputeRound: input.disputeRound,
    bucket: partnerProgressBucket(input.status),
  }
}

export function isReferralProfileAttributable(status: string | null | undefined): boolean {
  return status === 'active'
}

export function shouldSkipPartnerCommission(profile: {
  client_id?: string | null
  partner_profile_id?: string | null
}): boolean {
  return Boolean(profile.partner_profile_id) && !profile.client_id
}
