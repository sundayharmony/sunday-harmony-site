import { decryptApplicationSensitiveFields } from '@/lib/credit-funding-sensitive-fields'
import type { CreditFundingApplication } from '@/lib/credit-funding-types'

/** Full application record for admin detail views (decrypts sensitive fields). */
export function formatApplicationForAdmin(app: CreditFundingApplication) {
  return decryptApplicationSensitiveFields(app)
}

/** Admin list rows — contact info decrypted for staff follow-up. */
export function formatApplicationListItemForAdmin(app: CreditFundingApplication) {
  const decrypted = decryptApplicationSensitiveFields(app)
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
