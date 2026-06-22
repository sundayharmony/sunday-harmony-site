export const CREDIT_PROVIDERS = ['IdentityIQ', 'Credit Hero Score', 'SmartCredit'] as const
export type CreditProvider = (typeof CREDIT_PROVIDERS)[number]

export const IDENTITY_DOCUMENT_TYPES = ['photo_id', 'proof_of_address', 'selfie_with_id', 'mail_proof'] as const
export const BUSINESS_DOCUMENT_TYPES = [
  'articles_of_organization',
  'ein_letter',
  'business_license',
  'bank_statements',
  'tax_returns',
  'profit_and_loss',
  'balance_sheet',
  'other_business',
] as const
export const DOCUMENT_TYPES = [...IDENTITY_DOCUMENT_TYPES, ...BUSINESS_DOCUMENT_TYPES] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const APPLICATION_STATUSES = [
  'submitted',
  'documents_pending',
  'under_review',
  'credit_analysis_complete',
  'funding_review',
  'additional_information_requested',
  'approved',
  'declined',
  'completed',
  'archived',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  documents_pending: 'Documents Pending',
  under_review: 'Under Review',
  credit_analysis_complete: 'Credit Analysis Complete',
  funding_review: 'Funding Review',
  additional_information_requested: 'Additional Information Requested',
  approved: 'Approved',
  declined: 'Declined',
  completed: 'Completed',
  archived: 'Archived',
}

export const STATUS_WORKFLOW_ORDER: ApplicationStatus[] = [
  'submitted',
  'documents_pending',
  'under_review',
  'credit_analysis_complete',
  'funding_review',
  'additional_information_requested',
  'approved',
  'completed',
]

export const ENTITY_TYPES = [
  'Sole Proprietorship',
  'LLC',
  'S-Corp',
  'C-Corp',
  'Partnership',
  'Non-Profit',
  'Other',
] as const

export const FUNDING_PURPOSE_OPTIONS = [
  'Working Capital',
  'Equipment Purchase',
  'Inventory',
  'Expansion',
  'Debt Consolidation',
  'Real Estate',
  'Marketing',
  'Payroll',
  'Other',
] as const

export const CREDIT_GOAL_OPTIONS = [
  'Credit Repair',
  'Increase Credit Score',
  'Remove Negative Items',
  'Personal Funding',
  'Business Funding',
  'Business Credit Building',
  'Mortgage Preparation',
  'Auto Loan Preparation',
] as const

export const FUNDING_TIMEFRAMES = ['Immediately', '30 Days', '60 Days', '90+ Days'] as const

export const CREDIT_FUNDING_MAX_BYTES = 20 * 1024 * 1024

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  photo_id: 'Government Photo ID',
  proof_of_address: 'Proof of Address',
  selfie_with_id: 'Selfie with ID',
  mail_proof: 'Mail Proof',
  articles_of_organization: 'Articles of Organization / Incorporation',
  ein_letter: 'EIN Letter (IRS SS-4)',
  business_license: 'Business License',
  bank_statements: 'Business Bank Statements (3 months)',
  tax_returns: 'Business Tax Returns',
  profit_and_loss: 'Profit & Loss Statement',
  balance_sheet: 'Balance Sheet',
  other_business: 'Other Business Document',
}

export interface CreditProfile {
  creditScore?: string
  bankruptcy?: boolean
  collections?: boolean
  chargeOffs?: boolean
  latePayments24Months?: boolean
  openCreditCards?: string
  inquiries?: string
  employed?: boolean
  monthlyGrossIncome?: string
  annualIncome?: string
  businessOwner?: boolean
}

export interface BusinessProfile {
  legalName?: string
  dba?: string
  ein?: string
  einEncrypted?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  email?: string
  website?: string
  industry?: string
  entityType?: string
  yearEstablished?: string
  numberOfEmployees?: string
  annualRevenue?: string
  businessDescription?: string
  businessCreditScore?: string
  businessCreditCards?: string
  businessLoans?: boolean
  businessCollections?: boolean
  paydexScore?: string
  fundingPurposes?: string[]
  existingBusinessDebt?: boolean
  collateralAvailable?: boolean
  priorBusinessFunding?: boolean
  taxLiensOrJudgments?: boolean
}

export interface FundingScores {
  revenue_score?: number | null
  funding_readiness?: number | null
  credit_readiness?: number | null
  recommended_programs?: string[]
  estimated_range?: string
  specialist_notes?: string
}

export interface ConsentData {
  accurateInfo: boolean
  authorizeReview: boolean
  agreeTerms: boolean
}

export interface CreditFundingApplication {
  id: string
  application_id: string
  full_name: string
  date_of_birth_encrypted?: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  credit_profile: CreditProfile
  selected_credit_provider: string
  provider_username_encrypted?: string
  provider_password_encrypted?: string
  credit_goals: string[]
  funding_goals: string
  primary_credit_goals_text?: string
  funding_amount?: string
  funding_use?: string
  owns_business?: boolean
  business_name?: string
  funding_timeframe?: string
  goals_notes?: string
  consent_data: ConsentData
  typed_signature: string
  signature_date: string
  status: ApplicationStatus
  user_id?: string | null
  client_id?: string | null
  assigned_specialist?: string | null
  internal_notes?: string
  client_notes?: string
  next_steps?: string
  service_type?: string
  lead_type?: string | null
  credit_funding_client_status?: string | null
  lead_id?: string | null
  business_profile?: BusinessProfile
  funding_scores?: FundingScores
  created_at: string
  updated_at: string
}

export interface UploadedDocument {
  id: string
  application_uuid: string
  document_type: DocumentType
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  mime_type: string
  scan_status: 'pending' | 'clean' | 'rejected'
  created_at: string
}

export interface CreditFundingStatusHistory {
  id: string
  application_uuid: string
  status: ApplicationStatus
  staff_email?: string | null
  notes?: string
  created_at: string
}

export interface CreditFundingMessage {
  id: string
  application_uuid: string
  from_role: 'admin' | 'applicant'
  from_name: string
  from_email?: string | null
  text: string
  created_at: string
}

export interface CreditFundingDocumentRequest {
  id: string
  application_uuid: string
  document_type: string
  label: string
  notes?: string
  status: 'pending' | 'uploaded' | 'waived'
  requested_by?: string | null
  created_at: string
  fulfilled_at?: string | null
}

export function deriveServiceType(creditGoals: string[], fundingUse: string): string {
  const hasBusiness = creditGoals.some((g) => g.includes('Business')) || fundingUse === 'Business' || fundingUse === 'Both'
  const hasCredit = creditGoals.some((g) => g.includes('Credit') || g.includes('Repair') || g.includes('Score'))
  if (hasBusiness && hasCredit) return 'credit_and_funding'
  if (hasBusiness) return 'business_funding'
  if (hasCredit) return 'credit_repair'
  return 'credit_and_funding'
}

export function requiresBusinessSection(ownsBusiness: boolean, fundingUse: string, creditProfile?: CreditProfile): boolean {
  return ownsBusiness || fundingUse === 'Business' || fundingUse === 'Both' || creditProfile?.businessOwner === true
}

export { deriveLeadTypeFromIntake } from '@/lib/crm-types'
