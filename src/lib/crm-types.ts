export const LEAD_TYPES = [
  'marketing_lead',
  'credit_repair_lead',
  'personal_funding_lead',
  'business_funding_lead',
  'credit_repair_funding',
  'existing_client',
  'completed_client',
] as const
export type LeadType = (typeof LEAD_TYPES)[number]

export const MARKETING_LEAD_STATUSES = [
  'new_lead',
  'contacted',
  'consultation_scheduled',
  'qualified',
  'converted',
  'not_interested',
] as const
export type MarketingLeadStatus = (typeof MARKETING_LEAD_STATUSES)[number]

export const CREDIT_FUNDING_CLIENT_STATUSES = [
  'intake_started',
  'intake_completed',
  'documents_pending',
  'under_review',
  'credit_analysis',
  'funding_analysis',
  'recommendations_delivered',
  'active_client',
  'completed',
] as const
export type CreditFundingClientStatus = (typeof CREDIT_FUNDING_CLIENT_STATUSES)[number]

export const MEETING_TYPES = ['consultation', 'funding_review', 'credit_strategy', 'follow_up'] as const
export type MeetingType = (typeof MEETING_TYPES)[number]

export const MEETING_STATUSES = ['scheduled', 'completed', 'cancelled'] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]

export const CRM_ACTIVITY_ACTIONS = [
  'lead_created',
  'application_submitted',
  'documents_uploaded',
  'status_changed',
  'meeting_scheduled',
  'meeting_completed',
  'notes_added',
  'funding_recommendations_added',
] as const
export type CrmActivityAction = (typeof CRM_ACTIVITY_ACTIONS)[number]

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  marketing_lead: 'Marketing Lead',
  credit_repair_lead: 'Credit Repair Lead',
  personal_funding_lead: 'Personal Funding Lead',
  business_funding_lead: 'Business Funding Lead',
  credit_repair_funding: 'Credit Repair + Funding',
  existing_client: 'Existing Client',
  completed_client: 'Completed Client',
}

export const MARKETING_STATUS_LABELS: Record<MarketingLeadStatus, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  consultation_scheduled: 'Consultation Scheduled',
  qualified: 'Qualified',
  converted: 'Converted',
  not_interested: 'Not Interested',
}

export const CF_CLIENT_STATUS_LABELS: Record<CreditFundingClientStatus, string> = {
  intake_started: 'Intake Started',
  intake_completed: 'Intake Completed',
  documents_pending: 'Documents Pending',
  under_review: 'Under Review',
  credit_analysis: 'Credit Analysis',
  funding_analysis: 'Funding Analysis',
  recommendations_delivered: 'Recommendations Delivered',
  active_client: 'Active Client',
  completed: 'Completed',
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  consultation: 'Consultation',
  funding_review: 'Funding Review',
  credit_strategy: 'Credit Strategy Session',
  follow_up: 'Follow-Up',
}

export function deriveLeadTypeFromIntake(creditGoals: string[], fundingUse: string): LeadType {
  const goals = creditGoals.map((g) => g.toLowerCase())
  const hasCreditRepair = goals.some(
    (g) => g.includes('credit repair') || g.includes('remove negative') || g.includes('increase credit score')
  )
  const hasPersonalFunding = goals.some((g) => g.includes('personal funding'))
  const hasBusinessFunding = goals.some(
    (g) => g.includes('business funding') || g.includes('business credit')
  )
  const isBusiness = fundingUse === 'Business' || fundingUse === 'Both'

  if (hasCreditRepair && (hasPersonalFunding || hasBusinessFunding || isBusiness)) {
    return 'credit_repair_funding'
  }
  if (hasCreditRepair) return 'credit_repair_lead'
  if (hasBusinessFunding || isBusiness) return 'business_funding_lead'
  if (hasPersonalFunding || fundingUse === 'Personal') return 'personal_funding_lead'
  return 'credit_repair_funding'
}

export function mapApplicationStatusToCfClientStatus(appStatus: string): CreditFundingClientStatus {
  const map: Record<string, CreditFundingClientStatus> = {
    submitted: 'intake_completed',
    documents_pending: 'documents_pending',
    under_review: 'under_review',
    credit_analysis_complete: 'credit_analysis',
    funding_review: 'funding_analysis',
    additional_information_requested: 'documents_pending',
    approved: 'recommendations_delivered',
    completed: 'completed',
    declined: 'under_review',
    archived: 'completed',
  }
  return map[appStatus] || 'under_review'
}
