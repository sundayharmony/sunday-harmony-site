import {
  BUSINESS_DOCUMENT_TYPES,
  DOCUMENT_LABELS,
  type DocumentType,
} from '@/lib/credit-funding-types'

export interface DocumentStepItem {
  type: DocumentType
  label: string
  description: string
  required: boolean
  icon: string
}

export const IDENTITY_DOCUMENTS: DocumentStepItem[] = [
  {
    type: 'photo_id',
    label: DOCUMENT_LABELS.photo_id,
    description: "Driver's license, passport, or state-issued ID - front and back if applicable.",
    required: true,
    icon: '\u{1FA73}',
  },
  {
    type: 'mail_proof',
    label: DOCUMENT_LABELS.mail_proof,
    description: 'Photo of mail showing your full name and home address.',
    required: true,
    icon: '\u2709\uFE0F',
  },
  {
    type: 'proof_of_address',
    label: DOCUMENT_LABELS.proof_of_address,
    description: 'Utility bill, bank statement, or lease dated within the last 90 days.',
    required: false,
    icon: '\u{1F3E0}',
  },
  {
    type: 'selfie_with_id',
    label: DOCUMENT_LABELS.selfie_with_id,
    description: 'Clear photo of you holding your government ID next to your face.',
    required: false,
    icon: '\u{1F933}',
  },
]

const BUSINESS_DOC_DESCRIPTIONS: Partial<Record<DocumentType, string>> = {
  articles_of_organization: 'State filing document for your LLC, corporation, or partnership.',
  ein_letter: 'IRS EIN confirmation letter (Form SS-4 or CP 575).',
  business_license: 'Current local or state business license, if applicable.',
  bank_statements: 'Most recent three months of business bank statements.',
  tax_returns: 'Most recent business tax return (1120, 1120-S, or Schedule C).',
  profit_and_loss: 'Year-to-date or most recent P&L statement.',
  balance_sheet: 'Most recent balance sheet for your business.',
  other_business: 'Any additional document that supports your funding request.',
}

export const BUSINESS_DOCUMENTS: DocumentStepItem[] = BUSINESS_DOCUMENT_TYPES.map((type) => ({
  type,
  label: DOCUMENT_LABELS[type],
  description: BUSINESS_DOC_DESCRIPTIONS[type] || 'Upload a clear PDF or photo.',
  required: false,
  icon: '\u{1F4C4}',
}))
