import { randomBytes } from 'crypto'
import { getSupabase } from '@/lib/supabase'
import { encryptField } from '@/lib/field-encryption'
import type {
  ApplicationStatus,
  CreditFundingApplication,
  DocumentType,
  UploadedDocument,
} from '@/lib/credit-funding-types'
import type { IntakeFormPayload } from '@/lib/credit-funding-validation'
import { buildFundingGoalsSummary } from '@/lib/credit-funding-validation'

export function generateApplicationId(): string {
  const date = new Date()
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = randomBytes(3).toString('hex').toUpperCase()
  return `CF-${ymd}-${suffix}`
}

export async function createCreditFundingApplication(
  payload: IntakeFormPayload
): Promise<CreditFundingApplication | null> {
  const applicationId = generateApplicationId()
  const fundingGoals = buildFundingGoalsSummary(payload)

  const row = {
    application_id: applicationId,
    full_name: payload.fullName,
    date_of_birth_encrypted: encryptField(payload.dateOfBirth),
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
    city: payload.city,
    state: payload.state,
    zip_code: payload.zipCode,
    credit_profile: payload.creditProfile,
    selected_credit_provider: payload.selectedCreditProvider,
    provider_username_encrypted: encryptField(payload.providerUsername),
    provider_password_encrypted: encryptField(payload.providerPassword),
    credit_goals: payload.creditGoals,
    funding_goals: fundingGoals,
    primary_credit_goals_text: payload.primaryCreditGoalsText,
    funding_amount: payload.fundingAmount,
    funding_use: payload.fundingUse,
    owns_business: payload.ownsBusiness,
    business_name: payload.businessName || null,
    funding_timeframe: payload.fundingTimeframe,
    goals_notes: payload.goalsNotes,
    consent_data: payload.consent,
    typed_signature: payload.typedSignature,
    signature_date: payload.signatureDate,
    status: 'submitted' as ApplicationStatus,
  }

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('createCreditFundingApplication error:', error)
    return null
  }
  return data as CreditFundingApplication
}

export async function createUploadedDocument(doc: {
  application_uuid: string
  document_type: DocumentType
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  mime_type: string
  scan_status: 'clean' | 'rejected'
}): Promise<UploadedDocument | null> {
  const { data, error } = await getSupabase()
    .from('uploaded_documents')
    .insert(doc)
    .select()
    .single()

  if (error) {
    console.error('createUploadedDocument error:', error)
    return null
  }
  return data as UploadedDocument
}

export async function getCreditFundingApplications(filters?: {
  status?: string
  search?: string
}): Promise<CreditFundingApplication[]> {
  let query = getSupabase()
    .from('credit_funding_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) {
    console.error('getCreditFundingApplications error:', error)
    return []
  }

  let results = (data || []) as CreditFundingApplication[]
  const search = filters?.search?.trim().toLowerCase()
  if (search) {
    results = results.filter(
      (a) =>
        a.full_name.toLowerCase().includes(search) ||
        a.email.toLowerCase().includes(search) ||
        a.application_id.toLowerCase().includes(search) ||
        a.phone.includes(search)
    )
  }
  return results
}

export async function getCreditFundingApplicationById(id: string): Promise<CreditFundingApplication | undefined> {
  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return undefined
  return data as CreditFundingApplication
}

export async function getDocumentsByApplicationUuid(applicationUuid: string): Promise<UploadedDocument[]> {
  const { data, error } = await getSupabase()
    .from('uploaded_documents')
    .select('*')
    .eq('application_uuid', applicationUuid)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getDocumentsByApplicationUuid error:', error)
    return []
  }
  return (data || []) as UploadedDocument[]
}

export async function updateCreditFundingApplicationStatus(
  id: string,
  status: ApplicationStatus
): Promise<CreditFundingApplication | null> {
  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateCreditFundingApplicationStatus error:', error)
    return null
  }
  return data as CreditFundingApplication
}

export async function deleteCreditFundingApplication(id: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('credit_funding_applications')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteCreditFundingApplication error:', error)
    return false
  }
  return true
}
