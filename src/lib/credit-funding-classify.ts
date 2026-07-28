import type { LeadType } from '@/lib/crm-types'

export const FUNDING_USE_OPTIONS = ['Personal', 'Business', 'Both'] as const
export type FundingUse = (typeof FUNDING_USE_OPTIONS)[number]

export const SERVICE_TYPES = [
  'credit_repair',
  'personal_funding',
  'business_funding',
  'credit_and_funding',
] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export interface IntakeClassification {
  serviceType: ServiceType
  leadType: LeadType
  seekingFunding: boolean
}

export function isFundingUse(value: string): value is FundingUse {
  return FUNDING_USE_OPTIONS.includes(value as FundingUse)
}

/** True when intake indicates the applicant is seeking funding (not repair-only). */
export function isSeekingFunding(creditGoals: string[], fundingUse: string): boolean {
  if (isFundingUse(fundingUse)) return true
  const goals = creditGoals.map((g) => g.toLowerCase())
  return goals.some(
    (g) =>
      g.includes('personal funding') ||
      g.includes('business funding') ||
      g.includes('mortgage preparation') ||
      g.includes('auto loan preparation')
  )
}

/** Workflow path length follows funding intent, not business ownership. */
export function needsFundingWorkflow(creditGoals: string[], fundingUse: string): boolean {
  return isSeekingFunding(creditGoals, fundingUse)
}

function hasCreditRepairGoals(goals: string[]): boolean {
  return goals.some(
    (g) =>
      g.includes('credit repair') ||
      g.includes('remove negative') ||
      g.includes('increase credit score')
  )
}

function hasPersonalFundingSignal(goals: string[], fundingUse: string): boolean {
  return goals.some((g) => g.includes('personal funding')) || fundingUse === 'Personal'
}

function hasBusinessFundingSignal(goals: string[], fundingUse: string): boolean {
  return (
    goals.some((g) => g.includes('business funding') || g.includes('business credit')) ||
    fundingUse === 'Business' ||
    fundingUse === 'Both'
  )
}

/**
 * Single source of truth for service_type + lead_type + seekingFunding.
 * Replaces divergent deriveServiceType / deriveLeadTypeFromIntake heuristics.
 */
export function deriveIntakeClassification(
  creditGoals: string[],
  fundingUse: string
): IntakeClassification {
  const goals = creditGoals.map((g) => g.toLowerCase())
  const seekingFunding = isSeekingFunding(creditGoals, fundingUse)
  const repair = hasCreditRepairGoals(goals)
  const personal = hasPersonalFundingSignal(goals, fundingUse)
  const business = hasBusinessFundingSignal(goals, fundingUse)

  if (repair && seekingFunding) {
    return {
      serviceType: 'credit_and_funding',
      leadType: 'credit_repair_funding',
      seekingFunding: true,
    }
  }
  if (repair && !seekingFunding) {
    return {
      serviceType: 'credit_repair',
      leadType: 'credit_repair_lead',
      seekingFunding: false,
    }
  }
  if (business) {
    return {
      serviceType: 'business_funding',
      leadType: 'business_funding_lead',
      seekingFunding: true,
    }
  }
  if (personal || fundingUse === 'Personal') {
    return {
      serviceType: 'personal_funding',
      leadType: 'personal_funding_lead',
      seekingFunding: true,
    }
  }
  if (seekingFunding) {
    return {
      serviceType: 'credit_and_funding',
      leadType: 'credit_repair_funding',
      seekingFunding: true,
    }
  }
  return {
    serviceType: 'credit_repair',
    leadType: 'credit_repair_lead',
    seekingFunding: false,
  }
}

/** @deprecated Prefer deriveIntakeClassification(...).serviceType */
export function deriveServiceType(creditGoals: string[], fundingUse: string): ServiceType {
  return deriveIntakeClassification(creditGoals, fundingUse).serviceType
}

/** @deprecated Prefer deriveIntakeClassification(...).leadType */
export function deriveLeadTypeFromIntake(creditGoals: string[], fundingUse: string): LeadType {
  return deriveIntakeClassification(creditGoals, fundingUse).leadType
}
