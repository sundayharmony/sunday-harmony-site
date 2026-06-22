import { decryptField } from '@/lib/field-encryption'
import type { CreditFundingApplication } from '@/lib/credit-funding-types'

/** Full application record for admin detail views (decrypts sensitive fields). */
export function formatApplicationForAdmin(app: CreditFundingApplication) {
  const bp = (app.business_profile || {}) as Record<string, unknown>
  const einEncrypted = bp.einEncrypted as string | undefined
  const businessProfile = {
    ...bp,
    ein: einEncrypted ? decryptField(einEncrypted) : (bp.ein as string | undefined),
    einEncrypted: undefined,
  }

  return {
    ...app,
    date_of_birth: decryptField(app.date_of_birth_encrypted || ''),
    provider_username: decryptField(app.provider_username_encrypted || ''),
    provider_password: decryptField(app.provider_password_encrypted || ''),
    date_of_birth_encrypted: undefined,
    provider_username_encrypted: undefined,
    provider_password_encrypted: undefined,
    business_profile: businessProfile,
  }
}

/** Admin list rows — full contact info for staff follow-up. */
export function formatApplicationListItemForAdmin(app: CreditFundingApplication) {
  return {
    id: app.id,
    application_id: app.application_id,
    full_name: app.full_name,
    email: app.email,
    phone: app.phone,
    service_type: app.service_type,
    credit_goals: app.credit_goals,
    funding_goals: app.funding_goals,
    selected_credit_provider: app.selected_credit_provider,
    status: app.status,
    assigned_specialist: app.assigned_specialist,
    created_at: app.created_at,
    updated_at: app.updated_at,
  }
}
