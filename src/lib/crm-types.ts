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
  'declined',
  'archived',
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
  declined: 'Declined',
  archived: 'Archived',
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  consultation: 'Consultation',
  funding_review: 'Funding Review',
  credit_strategy: 'Credit Strategy Session',
  follow_up: 'Follow-Up',
}

export {
  deriveLeadTypeFromIntake,
  deriveIntakeClassification,
  isSeekingFunding,
  needsFundingWorkflow,
} from '@/lib/credit-funding-classify'

export function mapApplicationStatusToCfClientStatus(appStatus: string): CreditFundingClientStatus {
  const map: Record<string, CreditFundingClientStatus> = {
    submitted: 'intake_completed',
    draft: 'intake_started',
    invitation_pending: 'intake_started',
    documents_pending: 'documents_pending',
    under_review: 'under_review',
    credit_analysis_complete: 'credit_analysis',
    funding_review: 'funding_analysis',
    additional_information_requested: 'documents_pending',
    approved: 'active_client',
    completed: 'completed',
    declined: 'declined',
    archived: 'archived',
  }
  return map[appStatus] || 'under_review'
}
