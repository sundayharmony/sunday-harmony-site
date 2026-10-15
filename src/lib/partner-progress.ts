import { STATUS_STRIP_LABELS, type ApplicationStatus } from '@/lib/credit-funding-types'
import { maskApplicantName } from '@/lib/referrals'

const CLOSED = new Set(['declined', 'archived'])

export type PartnerCurrentScores = {
  transunion: number | null
  experian: number | null
  equifax: number | null
}

export type PartnerReferralProgress = {
  id: string
  date: string
  applicant: string
  stage: string
  updatedAt: string
  disputeRound: number | null
  bucket: 'in_progress' | 'completed' | 'closed'
  currentScores: PartnerCurrentScores | null
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

/** Latest bureau scores safe to show a partner. Null when no bureau has a score yet. */
export function partnerCurrentScores(scores: {
  tuc?: number | null
  exp?: number | null
  equifax?: number | null
  eqf?: number | null
} | null | undefined): PartnerCurrentScores | null {
  if (!scores) return null
  const current: PartnerCurrentScores = {
    transunion: scoreOrNull(scores.tuc),
    experian: scoreOrNull(scores.exp),
    equifax: scoreOrNull(scores.equifax ?? scores.eqf),
  }
  if (current.transunion == null && current.experian == null && current.equifax == null) return null
  return current
}

function scoreOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Privacy-safe row for a partner. Callers must not pass emails, documents, or full legal names. */
export function toPartnerReferralProgress(input: {
  id: string
  date: string
  fullName: string
  status: string
  updatedAt: string
  disputeRound: number | null
  currentScores?: PartnerCurrentScores | null
}): PartnerReferralProgress {
  return {
    id: input.id,
    date: input.date,
    applicant: maskApplicantName(input.fullName),
    stage: partnerStageLabel(input.status),
    updatedAt: input.updatedAt,
    disputeRound: input.disputeRound,
    bucket: partnerProgressBucket(input.status),
    currentScores: input.currentScores ?? null,
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
