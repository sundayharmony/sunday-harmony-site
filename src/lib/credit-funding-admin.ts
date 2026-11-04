import {
  decryptApplicationSensitiveFields,
  decryptApplicationOperationalFields,
  redactApplicationSecretsForDefaultAdmin,
} from '@/lib/credit-funding-sensitive-fields'
import { isEncryptedField } from '@/lib/field-encryption'
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
    draft_source: decrypted.draft_source || null,
    created_by_staff_email: decrypted.created_by_staff_email || null,
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
  | 'experian_security_answer'
  | 'experian_pin'
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
  'experian_security_answer',
  'experian_pin',
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

function creditProfileFieldPresent(
  profile: CreditFundingApplication['credit_profile'] | undefined,
  key: 'monthlyGrossIncome' | 'annualIncome'
): boolean {
  const raw = profile?.[key]
  return Boolean(typeof raw === 'string' && raw.trim())
}

function businessEinPresent(app: CreditFundingApplication): boolean {
  const bp = app.business_profile as Record<string, unknown> | null | undefined
  if (!bp) return false
  const encrypted = bp.einEncrypted
  if (typeof encrypted === 'string' && encrypted.trim()) return true
  const legacy = bp.ein
  return Boolean(typeof legacy === 'string' && legacy.trim())
}

/** True when the application row has ciphertext (or legacy plaintext) for this secret. */
export function applicationHasSensitiveField(
  app: CreditFundingApplication,
  field: CreditFundingSensitiveRevealField
): boolean {
  switch (field) {
    case 'date_of_birth':
      return Boolean(app.date_of_birth_encrypted?.trim())
    case 'ssn':
      return Boolean(app.ssn_encrypted?.trim())
    case 'provider_username':
      return Boolean(app.provider_username_encrypted?.trim())
    case 'provider_password':
      return Boolean(app.provider_password_encrypted?.trim())
    case 'experian_email':
      return Boolean(app.experian_email_encrypted?.trim())
    case 'experian_password':
      return Boolean(app.experian_password_encrypted?.trim())
    case 'experian_security_answer':
      return Boolean(app.experian_security_answer_encrypted?.trim())
    case 'experian_pin':
      return Boolean(app.experian_pin_encrypted?.trim())
    case 'cfpb_email':
      return Boolean(app.cfpb_email_encrypted?.trim())
    case 'cfpb_password':
      return Boolean(app.cfpb_password_encrypted?.trim())
    case 'typed_signature':
      return Boolean(app.typed_signature?.trim())
    case 'monthly_gross_income':
      return creditProfileFieldPresent(app.credit_profile, 'monthlyGrossIncome')
    case 'annual_income':
      return creditProfileFieldPresent(app.credit_profile, 'annualIncome')
    case 'business_ein':
      return businessEinPresent(app)
  }
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
    case 'experian_security_answer':
      return decrypted.experian_security_answer || ''
    case 'experian_pin':
      return decrypted.experian_pin || ''
    case 'cfpb_email':
      return decrypted.cfpb_email || ''
    case 'cfpb_password':
      return decrypted.cfpb_password || ''
    case 'typed_signature': {
      const signature = decrypted.typed_signature || ''
      return signature === 'Pending' ? '' : signature
    }
    case 'monthly_gross_income':
      return decrypted.credit_profile?.monthlyGrossIncome || ''
    case 'annual_income':
      return decrypted.credit_profile?.annualIncome || ''
    case 'business_ein':
      return decrypted.business_profile?.ein || ''
  }
}

export type SensitiveRevealResult =
  | { ok: true; value: string }
  | { ok: false; error: string }

/** Reveal with explicit success/failure so the UI never treats empty decrypt as success. */
export function revealApplicationSensitiveFieldResult(
  app: CreditFundingApplication,
  field: CreditFundingSensitiveRevealField
): SensitiveRevealResult {
  if (!applicationHasSensitiveField(app, field)) {
    return { ok: false, error: 'No value on file for this field' }
  }
  const value = revealApplicationSensitiveField(app, field)
  if (!value) {
    // Ciphertext exists but could not be read — usually a key mismatch or corrupt blob.
    const rawIncome =
      field === 'monthly_gross_income'
        ? app.credit_profile?.monthlyGrossIncome
        : field === 'annual_income'
          ? app.credit_profile?.annualIncome
          : null
    if (rawIncome && !isEncryptedField(rawIncome) && rawIncome !== '••••••••') {
      return { ok: true, value: rawIncome }
    }
    return {
      ok: false,
      error: 'Could not decrypt this field. Ask an admin to verify CREDIT_FUNDING_ENCRYPTION_KEY.',
    }
  }
  return { ok: true, value }
}
