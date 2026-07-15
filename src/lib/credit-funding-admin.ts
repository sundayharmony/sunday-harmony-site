import {
  decryptApplicationSensitiveFields,
  decryptApplicationOperationalFields,
  redactApplicationSecretsForDefaultAdmin,
} from '@/lib/credit-funding-sensitive-fields'
import type { CreditFundingApplication } from '@/lib/credit-funding-types'

/** Default admin detail payload: operational fields are readable, secrets require explicit reveal. */
export function formatApplicationForAdmin(app: CreditFundingApplication) {
  return redactApplicationSecretsForDefaultAdmin(app)
}

/** Admin list rows — contact info decrypted for staff follow-up. */
export function formatApplicationListItemForAdmin(app: CreditFundingApplication) {
  const decrypted = decryptApplicationOperationalFields(app)
  return {
    id: decrypted.id,
    application_id: decrypted.application_id,
    full_name: decrypted.full_name,
    email: decrypted.email,
    phone: decrypted.phone,
    service_type: decrypted.service_type,
    credit_goals: decrypted.credit_goals,
    funding_goals: decrypted.funding_goals,
    selected_credit_provider: decrypted.selected_credit_provider,
    status: decrypted.status,
    assigned_specialist: decrypted.assigned_specialist,
    created_at: decrypted.created_at,
    updated_at: decrypted.updated_at,
  }
}

export type CreditFundingSensitiveRevealField =
  | 'date_of_birth'
  | 'ssn'
  | 'provider_username'
  | 'provider_password'
  | 'experian_email'
  | 'experian_password'
  | 'cfpb_email'
  | 'cfpb_password'
  | 'typed_signature'
  | 'monthly_gross_income'
  | 'annual_income'
  | 'business_ein'

export const CREDIT_FUNDING_REVEAL_FIELDS: readonly CreditFundingSensitiveRevealField[] = [
  'date_of_birth',
  'ssn',
  'provider_username',
  'provider_password',
  'experian_email',
  'experian_password',
  'cfpb_email',
  'cfpb_password',
  'typed_signature',
  'monthly_gross_income',
  'annual_income',
  'business_ein',
] as const

export function isCreditFundingRevealField(
  value: unknown
): value is CreditFundingSensitiveRevealField {
  return (
    typeof value === 'string' &&
    CREDIT_FUNDING_REVEAL_FIELDS.includes(value as CreditFundingSensitiveRevealField)
  )
}

export function revealApplicationSensitiveField(
  app: CreditFundingApplication,
  field: CreditFundingSensitiveRevealField
): string {
  const decrypted = decryptApplicationSensitiveFields(app)

  switch (field) {
    case 'date_of_birth':
      return decrypted.date_of_birth || ''
    case 'ssn':
      return decrypted.ssn || ''
    case 'provider_username':
      return decrypted.provider_username || ''
    case 'provider_password':
      return decrypted.provider_password || ''
    case 'experian_email':
      return decrypted.experian_email || ''
    case 'experian_password':
      return decrypted.experian_password || ''
    case 'cfpb_email':
      return decrypted.cfpb_email || ''
    case 'cfpb_password':
      return decrypted.cfpb_password || ''
    case 'typed_signature':
      return decrypted.typed_signature || ''
    case 'monthly_gross_income':
      return decrypted.credit_profile?.monthlyGrossIncome || ''
    case 'annual_income':
      return decrypted.credit_profile?.annualIncome || ''
    case 'business_ein':
      return decrypted.business_profile?.ein || ''
  }
}
