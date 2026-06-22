import { randomBytes } from 'crypto'
import { getSupabase } from '@/lib/supabase'
import { encryptField } from '@/lib/field-encryption'
import type {
  ApplicationStatus,
  CreditFundingApplication,
  CreditFundingDocumentRequest,
  CreditFundingMessage,
  CreditFundingStatusHistory,
  DocumentType,
  FundingScores,
  UploadedDocument,
} from '@/lib/credit-funding-types'
import { deriveServiceType } from '@/lib/credit-funding-types'
import type { IntakeFormPayload } from '@/lib/credit-funding-validation'
import { buildFundingGoalsSummary, serializeBusinessProfileForDb } from '@/lib/credit-funding-validation'

export function generateApplicationId(): string {
  const date = new Date()
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = randomBytes(3).toString('hex').toUpperCase()
  return `CF-${ymd}-${suffix}`
}

export async function createCreditFundingApplication(
  payload: IntakeFormPayload,
  link?: { userId?: string; clientId?: string }
): Promise<CreditFundingApplication | null> {
  const applicationId = generateApplicationId()
  const fundingGoals = buildFundingGoalsSummary(payload)
  const businessProfile = serializeBusinessProfileForDb(payload.businessProfile, encryptField)

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
    business_name: payload.businessProfile.legalName || payload.businessName || null,
    funding_timeframe: payload.fundingTimeframe,
    goals_notes: payload.goalsNotes,
    consent_data: payload.consent,
    typed_signature: payload.typedSignature,
    signature_date: payload.signatureDate,
    status: 'submitted' as ApplicationStatus,
    service_type: deriveServiceType(payload.creditGoals, payload.fundingUse),
    business_profile: businessProfile,
    user_id: link?.userId || null,
    client_id: link?.clientId || null,
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

  const app = data as CreditFundingApplication
  await createStatusHistory({
    application_uuid: app.id,
    status: 'submitted',
    staff_email: null,
    notes: 'Application submitted via intake form',
  })

  return app
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
        a.phone.includes(search) ||
        (a.assigned_specialist || '').toLowerCase().includes(search)
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

export async function getCreditFundingApplicationByEmail(email: string): Promise<CreditFundingApplication | undefined> {
  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return undefined
  return data as CreditFundingApplication | undefined
}

export async function getCreditFundingApplicationByUserId(userId: string): Promise<CreditFundingApplication | undefined> {
  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return undefined
  return data as CreditFundingApplication | undefined
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

export async function updateCreditFundingApplication(
  id: string,
  updates: Partial<{
    status: ApplicationStatus
    assigned_specialist: string | null
    internal_notes: string
    client_notes: string
    next_steps: string
    funding_scores: FundingScores
    service_type: string
    user_id: string | null
    client_id: string | null
  }>
): Promise<CreditFundingApplication | null> {
  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('updateCreditFundingApplication error:', error)
    return null
  }
  return data as CreditFundingApplication
}

export async function updateCreditFundingApplicationStatus(
  id: string,
  status: ApplicationStatus,
  meta?: { staffEmail?: string; notes?: string }
): Promise<CreditFundingApplication | null> {
  const updated = await updateCreditFundingApplication(id, { status })
  if (updated) {
    await createStatusHistory({
      application_uuid: id,
      status,
      staff_email: meta?.staffEmail || null,
      notes: meta?.notes || `Status changed to ${status}`,
    })
  }
  return updated
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

export async function createStatusHistory(entry: {
  application_uuid: string
  status: ApplicationStatus
  staff_email?: string | null
  notes?: string
}): Promise<CreditFundingStatusHistory | null> {
  const { data, error } = await getSupabase()
    .from('credit_funding_status_history')
    .insert({
      application_uuid: entry.application_uuid,
      status: entry.status,
      staff_email: entry.staff_email || null,
      notes: entry.notes || '',
    })
    .select()
    .single()

  if (error) {
    console.error('createStatusHistory error:', error)
    return null
  }
  return data as CreditFundingStatusHistory
}

export async function getStatusHistory(applicationUuid: string): Promise<CreditFundingStatusHistory[]> {
  const { data, error } = await getSupabase()
    .from('credit_funding_status_history')
    .select('*')
    .eq('application_uuid', applicationUuid)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getStatusHistory error:', error)
    return []
  }
  return (data || []) as CreditFundingStatusHistory[]
}

export async function getCreditFundingMessages(applicationUuid: string): Promise<CreditFundingMessage[]> {
  const { data, error } = await getSupabase()
    .from('credit_funding_messages')
    .select('*')
    .eq('application_uuid', applicationUuid)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getCreditFundingMessages error:', error)
    return []
  }
  return (data || []) as CreditFundingMessage[]
}

export async function createCreditFundingMessage(msg: {
  application_uuid: string
  from_role: 'admin' | 'applicant'
  from_name: string
  from_email?: string
  text: string
}): Promise<CreditFundingMessage | null> {
  const { data, error } = await getSupabase()
    .from('credit_funding_messages')
    .insert(msg)
    .select()
    .single()

  if (error) {
    console.error('createCreditFundingMessage error:', error)
    return null
  }
  return data as CreditFundingMessage
}

export async function getDocumentRequests(applicationUuid: string): Promise<CreditFundingDocumentRequest[]> {
  const { data, error } = await getSupabase()
    .from('credit_funding_document_requests')
    .select('*')
    .eq('application_uuid', applicationUuid)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getDocumentRequests error:', error)
    return []
  }
  return (data || []) as CreditFundingDocumentRequest[]
}

export async function createDocumentRequest(req: {
  application_uuid: string
  document_type: string
  label: string
  notes?: string
  requested_by?: string
}): Promise<CreditFundingDocumentRequest | null> {
  const { data, error } = await getSupabase()
    .from('credit_funding_document_requests')
    .insert({ ...req, status: 'pending' })
    .select()
    .single()

  if (error) {
    console.error('createDocumentRequest error:', error)
    return null
  }
  return data as CreditFundingDocumentRequest
}

export async function fulfillDocumentRequest(id: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('credit_funding_document_requests')
    .update({ status: 'uploaded', fulfilled_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('fulfillDocumentRequest error:', error)
    return false
  }
  return true
}

export async function linkApplicationToUser(applicationId: string, userId: string, clientId?: string): Promise<boolean> {
  const updates: Record<string, string | null> = { user_id: userId }
  if (clientId) updates.client_id = clientId

  const { error } = await getSupabase()
    .from('credit_funding_applications')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', applicationId)

  if (error) {
    console.error('linkApplicationToUser error:', error)
    return false
  }
  return true
}
