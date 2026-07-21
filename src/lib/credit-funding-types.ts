export const LISTED_CREDIT_PROVIDERS = ['IdentityIQ', 'Credit Hero Score', 'SmartCredit'] as const
export type ListedCreditProvider = (typeof LISTED_CREDIT_PROVIDERS)[number]

export const CREDIT_PROVIDERS = [...LISTED_CREDIT_PROVIDERS, 'Other'] as const
export type CreditProvider = (typeof CREDIT_PROVIDERS)[number]

/** Official Experian.com account registration — shown above Experian credential fields on Step 4. */
export const EXPERIAN_SIGNUP_URL = 'https://usa.experian.com/registration/'

/** CFPB consumer portal registration — shown above CFPB credential fields on Step 4. */
export const CFPB_PORTAL_URL = 'https://portal.consumerfinance.gov/consumer/s/login/SelfRegister'

/** Affiliate / signup URLs shown on Step 4 when a listed provider is selected. */
export const CREDIT_PROVIDER_SIGNUP_LINKS: Record<ListedCreditProvider, string> = {
  IdentityIQ: 'https://protect.identityiq.com/idp/idprotect/identityiq-google-branded/?aff_id=1582&aff_sub=identityiq%20trial&gad_source=1&gad_campaignid=14899793009&gbraid=0AAAAADqklV352qWLWjQJ9WVZDYqRzi1eK&gclid=CjwKCAjw3ejRBhAdEiwADkqPn6jMk2A1HW5dnbF1KhqidkCpOe-SHR_WouvL6B02jMH4MkJj0SsNuRoC_u0QAvD_BwE',
  'Credit Hero Score': 'https://www.creditheroscore.com/signup.asp',
  SmartCredit: 'https://www.smartcredit.com/join/',
}

/** Whether the provider link opens a login portal (vs. signup/affiliate). */
export const CREDIT_PROVIDER_LINK_ACTION: Record<ListedCreditProvider, 'signup' | 'login'> = {
  IdentityIQ: 'signup',
  'Credit Hero Score': 'signup',
  SmartCredit: 'signup',
}

/** Trial-cancel warning applies to paid-trial monitoring services, not free/government portals. */
export const CREDIT_PROVIDER_TRIAL_WARNING: Record<ListedCreditProvider, boolean> = {
  IdentityIQ: true,
  'Credit Hero Score': true,
  SmartCredit: true,
}

function isListedCreditProvider(provider: string): provider is ListedCreditProvider {
  return LISTED_CREDIT_PROVIDERS.includes(provider as ListedCreditProvider)
}

export function getCreditProviderSignupLink(provider: string): string | null {
  if (!isListedCreditProvider(provider)) return null
  return CREDIT_PROVIDER_SIGNUP_LINKS[provider]
}

export function getCreditProviderLinkAction(provider: string): 'signup' | 'login' | null {
  if (!isListedCreditProvider(provider)) return null
  return CREDIT_PROVIDER_LINK_ACTION[provider]
}

export function creditProviderShowsTrialWarning(provider: string): boolean {
  if (!isListedCreditProvider(provider)) return false
  return CREDIT_PROVIDER_TRIAL_WARNING[provider]
}

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
export const STAFF_DOCUMENT_TYPES = ['staff_shared'] as const
export const DOCUMENT_TYPES = [...IDENTITY_DOCUMENT_TYPES, ...BUSINESS_DOCUMENT_TYPES] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]
export type StaffDocumentType = (typeof STAFF_DOCUMENT_TYPES)[number]
export type StorageDocumentType = DocumentType | StaffDocumentType

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && DOCUMENT_TYPES.includes(value as DocumentType)
}

export const APPLICATION_STATUSES = [
  'draft',
  'invitation_pending',
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
  draft: 'Draft',
  invitation_pending: 'Invitation Sent',
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

export const TERMINAL_STATUSES: ApplicationStatus[] = ['declined', 'archived', 'completed']

export const STATUS_DESCRIPTIONS: Record<ApplicationStatus, string> = {
  draft: 'Staff-entered draft — incomplete. Save and return later, finalize, or email the client to finish.',
  invitation_pending: 'Application link sent — waiting for the client to complete the intake form.',
  submitted: 'Application received — review intake and confirm all required documents are on file.',
  documents_pending: 'Waiting on documents from the applicant — request missing files below.',
  under_review: 'Team is reviewing the application, credit profile, and uploaded documents.',
  credit_analysis_complete: 'Credit analysis finished — proceed to funding evaluation when ready.',
  funding_review: 'Evaluating funding options and preparing recommendations.',
  additional_information_requested: 'More information or documents needed from the applicant.',
  approved: 'Application approved — notify client of next steps and funding recommendations.',
  declined: 'Application was declined — no further action required unless reopening.',
  completed: 'Application process is complete.',
  archived: 'Application archived for record-keeping.',
}

export const STATUS_ACTION_HINTS: Partial<Record<ApplicationStatus, string>> = {
  submitted: 'Request documents',
  documents_pending: 'Begin review',
  under_review: 'Mark credit analysis complete',
  credit_analysis_complete: 'Start funding review',
  funding_review: 'Request additional info',
  additional_information_requested: 'Return to review',
  approved: 'Mark completed',
}

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function isInWorkflow(status: ApplicationStatus): boolean {
  return STATUS_WORKFLOW_ORDER.includes(status)
}

export function getWorkflowIndex(status: ApplicationStatus): number {
  return STATUS_WORKFLOW_ORDER.indexOf(status)
}

export function getNextWorkflowStatus(status: ApplicationStatus): ApplicationStatus | null {
  if (isTerminalStatus(status)) return null
  const idx = getWorkflowIndex(status)
  if (idx < 0) return STATUS_WORKFLOW_ORDER[0] ?? null
  if (idx >= STATUS_WORKFLOW_ORDER.length - 1) return null
  return STATUS_WORKFLOW_ORDER[idx + 1]
}

export function getPreviousWorkflowStatus(status: ApplicationStatus): ApplicationStatus | null {
  if (isTerminalStatus(status)) return null
  const idx = getWorkflowIndex(status)
  if (idx <= 0) return null
  return STATUS_WORKFLOW_ORDER[idx - 1]
}

export function getWorkflowStepDistance(from: ApplicationStatus, to: ApplicationStatus): number {
  const fromIdx = getWorkflowIndex(from)
  const toIdx = getWorkflowIndex(to)
  if (fromIdx < 0 || toIdx < 0) return Math.abs(fromIdx - toIdx) || 99
  return Math.abs(toIdx - fromIdx)
}

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

/** Max per-file size for uploads via Vercel serverless (request body limit ~4.5 MB). */
export const CREDIT_FUNDING_MAX_BYTES = 4 * 1024 * 1024
export const CREDIT_FUNDING_MAX_MB = CREDIT_FUNDING_MAX_BYTES / (1024 * 1024)

const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'txt'] as const

/** Client/server-safe validation message for a single upload. */
export function getCreditFundingFileValidationError(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_UPLOAD_EXTENSIONS.includes(ext as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number])) {
    return 'Allowed types: PDF, JPG, JPEG, PNG, TXT'
  }
  if (file.size > CREDIT_FUNDING_MAX_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
    return `This file is ${sizeMb} MB — maximum is ${CREDIT_FUNDING_MAX_MB} MB. Compress it or use a smaller photo before continuing.`
  }
  return null
}

export function defaultDocumentDisplayTitle(originalFileName: string): string {
  const base = originalFileName.replace(/^.*[/\\]/, '').trim() || 'Document'
  const dot = base.lastIndexOf('.')
  if (dot > 0) return base.slice(0, dot)
  return base
}

export function sanitizeDocumentDisplayTitle(title: string | undefined, fallbackFileName: string): string {
  const cleaned = (title ?? '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
  return cleaned || defaultDocumentDisplayTitle(fallbackFileName)
}

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

export const STAFF_DOCUMENT_LABELS: Record<StaffDocumentType, string> = {
  staff_shared: 'Document from your specialist',
}

export function documentDisplayLabel(documentType: string): string {
  if (documentType in DOCUMENT_LABELS) {
    return DOCUMENT_LABELS[documentType as DocumentType]
  }
  if (documentType in STAFF_DOCUMENT_LABELS) {
    return STAFF_DOCUMENT_LABELS[documentType as StaffDocumentType]
  }
  return documentType.replace(/_/g, ' ')
}

export function isStaffSharedDocument(doc: {
  document_type?: string
  shared_by?: string | null
  storage_path?: string
}): boolean {
  if (doc.shared_by === 'admin') return true
  if (doc.document_type === 'staff_shared') return true
  return Boolean(doc.storage_path?.includes('/staff_shared/'))
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
  ssn_encrypted?: string
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
  experian_email_encrypted?: string
  experian_password_encrypted?: string
  cfpb_email_encrypted?: string
  cfpb_password_encrypted?: string
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
  invite_expires_at?: string | null
  invite_personal_message?: string | null
  created_by_staff_email?: string | null
  draft_source?: string | null
  business_profile?: BusinessProfile
  funding_scores?: FundingScores
  created_at: string
  updated_at: string
}

export interface UploadedDocument {
  id: string
  application_uuid: string
  document_type: StorageDocumentType
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  mime_type: string
  scan_status: 'pending' | 'clean' | 'rejected'
  shared_by?: 'applicant' | 'admin' | null
  status_history_id?: string | null
  message_id?: string | null
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
