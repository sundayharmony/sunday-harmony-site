export const CREDIT_PROVIDERS = ['IdentityIQ', 'Credit Hero Score', 'SmartCredit'] as const
export type CreditProvider = (typeof CREDIT_PROVIDERS)[number]

export const DOCUMENT_TYPES = ['photo_id', 'proof_of_address', 'selfie_with_id', 'mail_proof'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const APPLICATION_STATUSES = ['submitted', 'under_review', 'approved', 'denied', 'archived'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

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
