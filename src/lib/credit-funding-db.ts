import { randomBytes } from 'crypto'
import { getSupabase } from '@/lib/supabase'
import type {
  ApplicationStatus,
  CreditFundingApplication,
  CreditFundingDocumentRequest,
  CreditFundingMessage,
  CreditFundingStatusHistory,
  DocumentType,
  FundingScores,
  StorageDocumentType,
  UploadedDocument,
} from '@/lib/credit-funding-types'
import { deriveServiceType, deriveLeadTypeFromIntake, isStaffSharedDocument } from '@/lib/credit-funding-types'
import type { IntakeFormPayload } from '@/lib/credit-funding-validation'
import { buildFundingGoalsSummary } from '@/lib/credit-funding-validation'
import {
  buildEncryptedApplicationRow,
  buildEncryptedInvitationRow,
  buildPartialEncryptedApplicationRow,
  decryptFreeTextForView,
  encryptFreeTextForDb,
} from '@/lib/credit-funding-sensitive-fields'
import { decryptFieldOrLegacy } from '@/lib/field-encryption'
import { APPLICATION_INVITE_TTL_MS } from '@/lib/credit-funding-invite'
import {
  CREDIT_FUNDING_BUCKET,
  deleteAllCreditFundingFilesForApplication,
  deleteCreditFundingStoragePaths,
} from '@/lib/credit-funding-storage'

export function generateApplicationId(): string {
  const date = new Date()
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = randomBytes(3).toString('hex').toUpperCase()
  return `CF-${ymd}-${suffix}`
}

const CREDIT_FUNDING_LIST_SELECT = [
  'id',
  'application_id',
  'full_name',
  'email',
  'phone',
  'service_type',
  'credit_goals',
  'funding_goals',
  'selected_credit_provider',
  'status',
  'assigned_specialist',
  'funding_amount',
  'funding_use',
  'invite_expires_at',
  'invite_personal_message',
  'draft_source',
  'created_by_staff_email',
  'created_at',
  'updated_at',
].join(', ')

export async function createCreditFundingApplication(
  payload: IntakeFormPayload,
  link?: { userId?: string; clientId?: string }
): Promise<CreditFundingApplication | null> {
  const applicationId = generateApplicationId()
  const fundingGoals = buildFundingGoalsSummary(payload)
  const encrypted = buildEncryptedApplicationRow(payload, link)

  const row = {
    application_id: applicationId,
    ...encrypted,
    funding_goals: fundingGoals,
    status: 'submitted' as ApplicationStatus,
    service_type: deriveServiceType(payload.creditGoals, payload.fundingUse),
    lead_type: deriveLeadTypeFromIntake(payload.creditGoals, payload.fundingUse),
    credit_funding_client_status: 'intake_completed',
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

const INVITE_PLACEHOLDER = 'Pending'

export async function getPendingInvitationByEmail(email: string): Promise<CreditFundingApplication | undefined> {
  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .select('*')
    .ilike('email', email.trim())
    .eq('status', 'invitation_pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return undefined
  return data as CreditFundingApplication | undefined
}

export async function getOpenStaffDraftByEmail(email: string): Promise<CreditFundingApplication | undefined> {
  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .select('*')
    .ilike('email', email.trim())
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return undefined
  return data as CreditFundingApplication | undefined
}

/** Pending invite or open staff draft for the same email. */
export async function getBlockingIncompleteApplicationByEmail(
  email: string
): Promise<CreditFundingApplication | undefined> {
  const pending = await getPendingInvitationByEmail(email)
  if (pending) return pending
  return getOpenStaffDraftByEmail(email)
}

export async function createStaffDraftApplication(params: {
  payload: IntakeFormPayload
  staffEmail: string
  clientId?: string
}): Promise<CreditFundingApplication | null> {
  const blocking = await getBlockingIncompleteApplicationByEmail(params.payload.email)
  if (blocking) return null

  const applicationId = generateApplicationId()
  const encrypted = buildPartialEncryptedApplicationRow(params.payload)
  const fundingGoals = buildFundingGoalsSummary(params.payload)

  const row: Record<string, unknown> = {
    application_id: applicationId,
    ...encrypted,
    funding_goals: fundingGoals,
    status: 'draft' as ApplicationStatus,
    service_type: 'credit_and_funding',
    credit_funding_client_status: 'intake_started',
    client_id: params.clientId || null,
    created_by_staff_email: params.staffEmail,
    draft_source: 'staff_manual',
  }

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('createStaffDraftApplication error:', error)
    if (error.code === 'PGRST204' || /schema cache|column/i.test(error.message || '')) {
      console.error(
        'Hint: credit_funding_applications is missing a column the app expects. Apply supabase-migration-023-credit-funding-cfpb.sql (and any later migrations).'
      )
    }
    return null
  }

  const app = data as CreditFundingApplication
  await createStatusHistory({
    application_uuid: app.id,
    status: 'draft',
    staff_email: params.staffEmail,
    notes: 'Staff draft application created',
  })

  return app
}

export async function updateStaffDraftApplication(
  id: string,
  payload: IntakeFormPayload
): Promise<CreditFundingApplication | null> {
  const existing = await getCreditFundingApplicationById(id)
  if (!existing || existing.status !== 'draft') return null

  if (payload.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
    const blocking = await getBlockingIncompleteApplicationByEmail(payload.email)
    if (blocking && blocking.id !== id) return null
  }

  const encrypted = buildPartialEncryptedApplicationRow(payload, { preserveSecretsFrom: existing })
  const fundingGoals = buildFundingGoalsSummary(payload)

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update({
      ...encrypted,
      funding_goals: fundingGoals,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    console.error('updateStaffDraftApplication error:', error)
    return null
  }
  return data as CreditFundingApplication
}

export async function finalizeStaffDraftApplication(
  id: string,
  payload: IntakeFormPayload,
  link?: { userId?: string; clientId?: string },
  staffEmail?: string
): Promise<CreditFundingApplication | null> {
  const existing = await getCreditFundingApplicationById(id)
  if (!existing || existing.status !== 'draft') return null

  const fundingGoals = buildFundingGoalsSummary(payload)
  const encrypted = buildEncryptedApplicationRow(payload, {
    userId: link?.userId,
    clientId: link?.clientId || existing.client_id || undefined,
  })

  const row = {
    ...encrypted,
    funding_goals: fundingGoals,
    status: 'submitted' as ApplicationStatus,
    service_type: deriveServiceType(payload.creditGoals, payload.fundingUse),
    lead_type: deriveLeadTypeFromIntake(payload.creditGoals, payload.fundingUse),
    credit_funding_client_status: 'intake_completed',
    invite_expires_at: null,
    invite_personal_message: null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update(row)
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    console.error('finalizeStaffDraftApplication error:', error)
    return null
  }

  const app = data as CreditFundingApplication
  await createStatusHistory({
    application_uuid: app.id,
    status: 'submitted',
    staff_email: staffEmail || null,
    notes: 'Staff finalized draft application',
  })

  return app
}

export async function convertDraftToInvitationPending(
  id: string,
  inviteExpiresAt: Date,
  personalMessage?: string,
  staffEmail?: string
): Promise<CreditFundingApplication | null> {
  const updates: Record<string, unknown> = {
    status: 'invitation_pending',
    invite_expires_at: inviteExpiresAt.toISOString(),
    credit_funding_client_status: 'intake_started',
    updated_at: new Date().toISOString(),
  }
  if (personalMessage !== undefined) {
    updates.invite_personal_message = encryptFreeTextForDb(personalMessage) || null
  }

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update(updates)
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    console.error('convertDraftToInvitationPending error:', error)
    return null
  }

  const app = data as CreditFundingApplication
  await createStatusHistory({
    application_uuid: app.id,
    status: 'invitation_pending',
    staff_email: staffEmail || null,
    notes: 'Finish link emailed to client from staff draft',
  })

  return app
}

export async function cancelInvitationBackToDraft(
  id: string,
  staffEmail?: string
): Promise<CreditFundingApplication | null> {
  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update({
      status: 'draft',
      invite_expires_at: null,
      invite_personal_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'invitation_pending')
    .select()
    .single()

  if (error) {
    console.error('cancelInvitationBackToDraft error:', error)
    return null
  }

  const app = data as CreditFundingApplication
  await createStatusHistory({
    application_uuid: app.id,
    status: 'draft',
    staff_email: staffEmail || null,
    notes: 'Client finish link cancelled — returned to staff draft',
  })

  return app
}

export async function createInvitedCreditFundingApplication(params: {
  fullName: string
  email: string
  phone?: string
  clientId?: string
  invitedBy: string
  personalMessage?: string
  inviteExpiresAt?: Date
}): Promise<CreditFundingApplication | null> {
  const existingPending = await getPendingInvitationByEmail(params.email)
  if (existingPending) {
    return null
  }

  const applicationId = generateApplicationId()
  const inviteExpiresAt = params.inviteExpiresAt || new Date(Date.now() + APPLICATION_INVITE_TTL_MS)
  const normalizedEmail = params.email.trim().toLowerCase()
  const phone = params.phone?.trim() || INVITE_PLACEHOLDER

  const row: Record<string, unknown> = {
    application_id: applicationId,
    ...buildEncryptedInvitationRow({
      fullName: params.fullName,
      email: normalizedEmail,
      phone,
      clientId: params.clientId,
      inviteExpiresAt,
      personalMessage: params.personalMessage,
    }),
  }

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('createInvitedCreditFundingApplication error:', error)
    return null
  }

  const app = data as CreditFundingApplication
  await createStatusHistory({
    application_uuid: app.id,
    status: 'invitation_pending',
    staff_email: params.invitedBy,
    notes: 'Application invitation sent to client',
  })

  return app
}

export async function extendApplicationInvitation(
  id: string,
  inviteExpiresAt: Date,
  personalMessage?: string
): Promise<CreditFundingApplication | null> {
  const updates: Record<string, unknown> = {
    invite_expires_at: inviteExpiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (personalMessage !== undefined) {
    updates.invite_personal_message = encryptFreeTextForDb(personalMessage) || null
  }

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update(updates)
    .eq('id', id)
    .eq('status', 'invitation_pending')
    .select()
    .single()

  if (error) {
    console.error('extendApplicationInvitation error:', error)
    return null
  }
  return data as CreditFundingApplication
}

export async function completeInvitedCreditFundingApplication(
  applicationId: string,
  payload: IntakeFormPayload,
  link?: { userId?: string; clientId?: string }
): Promise<CreditFundingApplication | null> {
  const fundingGoals = buildFundingGoalsSummary(payload)
  const encrypted = buildEncryptedApplicationRow(payload, link)

  const row = {
    ...encrypted,
    funding_goals: fundingGoals,
    status: 'submitted' as ApplicationStatus,
    service_type: deriveServiceType(payload.creditGoals, payload.fundingUse),
    lead_type: deriveLeadTypeFromIntake(payload.creditGoals, payload.fundingUse),
    credit_funding_client_status: 'intake_completed',
    invite_expires_at: null,
    invite_personal_message: null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update(row)
    .eq('id', applicationId)
    .eq('status', 'invitation_pending')
    .select()
    .single()

  if (error) {
    console.error('completeInvitedCreditFundingApplication error:', error)
    return null
  }

  const app = data as CreditFundingApplication
  await createStatusHistory({
    application_uuid: app.id,
    status: 'submitted',
    staff_email: null,
    notes: 'Application completed via staff invitation link',
  })

  return app
}

export async function createUploadedDocument(doc: {
  application_uuid: string
  document_type: StorageDocumentType
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  mime_type: string
  scan_status: 'clean' | 'rejected'
  shared_by?: 'applicant' | 'admin'
  status_history_id?: string
  message_id?: string
}): Promise<UploadedDocument | null> {
  const base = {
    application_uuid: doc.application_uuid,
    document_type: doc.document_type,
    file_name: doc.file_name,
    file_type: doc.file_type,
    file_size: doc.file_size,
    storage_path: doc.storage_path,
    mime_type: doc.mime_type,
    scan_status: doc.scan_status,
  }

  const extended = {
    ...base,
    shared_by: doc.shared_by,
    status_history_id: doc.status_history_id,
    message_id: doc.message_id,
  }

  const attempts: Record<string, unknown>[] = [extended, base]

  if (doc.document_type === 'staff_shared') {
    attempts.push({ ...base, document_type: 'other_business' })
  }

  let lastError: { code?: string; message?: string } | null = null

  for (const row of attempts) {
    const cleaned = Object.fromEntries(
      Object.entries(row).filter(([, value]) => value !== undefined)
    )

    const { data, error } = await getSupabase()
      .from('uploaded_documents')
      .insert(cleaned)
      .select()
      .single()

    if (!error) {
      return data as UploadedDocument
    }

    lastError = error
    const retryable =
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      error.code === '23514' ||
      (error.message?.includes('column') ?? false) ||
      (error.message?.includes('check constraint') ?? false)

    if (!retryable) break
  }

  console.error('createUploadedDocument error:', lastError)
  return null
}

function displayNameFromStoredObjectName(objectName: string): string {
  const withoutUuid = objectName.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_/i,
    ''
  )
  return withoutUuid.replace(/_/g, ' ')
}

function mimeFromExtension(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    txt: 'text/plain',
  }
  return map[ext] || 'application/octet-stream'
}

/** Index staff-shared storage objects missing from uploaded_documents (e.g. after a failed DB insert). */
export async function syncStaffSharedDocumentsFromStorage(applicationUuid: string): Promise<number> {
  const supabase = getSupabase()
  const prefix = `${applicationUuid}/staff_shared`
  const { data: files, error } = await supabase.storage.from(CREDIT_FUNDING_BUCKET).list(prefix)
  if (error || !files?.length) return 0

  const { data: existing } = await supabase
    .from('uploaded_documents')
    .select('storage_path')
    .eq('application_uuid', applicationUuid)

  const existingPaths = new Set((existing || []).map((d) => d.storage_path as string))
  let synced = 0

  for (const file of files) {
    if (!file.name || file.name.startsWith('.')) continue
    const storagePath = `${prefix}/${file.name}`
    if (existingPaths.has(storagePath)) continue

    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : 'bin'
    const saved = await createUploadedDocument({
      application_uuid: applicationUuid,
      document_type: 'staff_shared',
      file_name: displayNameFromStoredObjectName(file.name),
      file_type: ext,
      file_size: file.metadata?.size || 0,
      storage_path: storagePath,
      mime_type: mimeFromExtension(ext),
      scan_status: 'clean',
      shared_by: 'admin',
    })
    if (saved) synced++
  }

  return synced
}

export async function getCreditFundingApplications(filters?: {
  status?: string
  search?: string
}): Promise<CreditFundingApplication[]> {
  let query = getSupabase()
    .from('credit_funding_applications')
    .select(CREDIT_FUNDING_LIST_SELECT)
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) {
    console.error('getCreditFundingApplications error:', error)
    return []
  }

  let results = (data || []) as unknown as CreditFundingApplication[]
  const search = filters?.search?.trim().toLowerCase()
  if (search) {
    results = results.filter(
      (a) =>
        a.full_name.toLowerCase().includes(search) ||
        a.email.toLowerCase().includes(search) ||
        a.application_id.toLowerCase().includes(search) ||
        decryptFieldOrLegacy(a.phone).includes(search) ||
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

export async function getUploadedDocumentById(id: string): Promise<UploadedDocument | undefined> {
  const { data, error } = await getSupabase()
    .from('uploaded_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('getUploadedDocumentById error:', error)
    return undefined
  }
  return data as UploadedDocument | undefined
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
  const encryptedUpdates = { ...updates }
  if (updates.internal_notes !== undefined) {
    encryptedUpdates.internal_notes = encryptFreeTextForDb(updates.internal_notes)
  }
  if (updates.client_notes !== undefined) {
    encryptedUpdates.client_notes = encryptFreeTextForDb(updates.client_notes)
  }
  if (updates.next_steps !== undefined) {
    encryptedUpdates.next_steps = encryptFreeTextForDb(updates.next_steps)
  }

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update({ ...encryptedUpdates, updated_at: new Date().toISOString() })
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
): Promise<{ app: CreditFundingApplication; history: CreditFundingStatusHistory } | null> {
  const updated = await updateCreditFundingApplication(id, { status })
  if (!updated) return null

  const history = await createStatusHistory({
    application_uuid: id,
    status,
    staff_email: meta?.staffEmail || null,
    notes: meta?.notes || `Status changed to ${status}`,
  })
  if (!history) return null

  return { app: updated, history }
}

export async function deleteCreditFundingApplication(id: string): Promise<boolean> {
  try {
    await deleteAllCreditFundingFilesForApplication(id)
  } catch (err) {
    console.error('deleteCreditFundingApplication storage cleanup:', err)
  }

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
      notes: encryptFreeTextForDb(entry.notes) || '',
    })
    .select()
    .single()

  if (error) {
    console.error('createStatusHistory error:', error)
    return null
  }
  const history = data as CreditFundingStatusHistory
  return { ...history, notes: decryptFreeTextForView(history.notes) }
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
  return ((data || []) as CreditFundingStatusHistory[]).map((entry) => ({
    ...entry,
    notes: decryptFreeTextForView(entry.notes),
  }))
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
  return ((data || []) as CreditFundingMessage[]).map((message) => ({
    ...message,
    text: decryptFreeTextForView(message.text),
  }))
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
    .insert({ ...msg, text: encryptFreeTextForDb(msg.text) || '' })
    .select()
    .single()

  if (error) {
    console.error('createCreditFundingMessage error:', error)
    return null
  }
  const message = data as CreditFundingMessage
  return { ...message, text: decryptFreeTextForView(message.text) }
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
  return ((data || []) as CreditFundingDocumentRequest[]).map((request) => ({
    ...request,
    notes: decryptFreeTextForView(request.notes),
  }))
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
    .insert({
      ...req,
      notes: encryptFreeTextForDb(req.notes) || '',
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('createDocumentRequest error:', error)
    return null
  }
  const request = data as CreditFundingDocumentRequest
  return { ...request, notes: decryptFreeTextForView(request.notes) }
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

/** Fulfill only if the request belongs to the given application (prevents cross-app IDOR). */
export async function fulfillDocumentRequestForApplication(
  id: string,
  applicationUuid: string
): Promise<boolean> {
  const { error } = await getSupabase()
    .from('credit_funding_document_requests')
    .update({ status: 'uploaded', fulfilled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('application_uuid', applicationUuid)

  if (error) {
    console.error('fulfillDocumentRequestForApplication error:', error)
    return false
  }
  return true
}

export async function reopenDocumentRequestForApplication(
  applicationUuid: string,
  documentType: string
): Promise<boolean> {
  const { error } = await getSupabase()
    .from('credit_funding_document_requests')
    .update({ status: 'pending', fulfilled_at: null })
    .eq('application_uuid', applicationUuid)
    .eq('document_type', documentType)
    .eq('status', 'uploaded')

  if (error) {
    console.error('reopenDocumentRequestForApplication error:', error)
    return false
  }
  return true
}

export type DeleteCreditFundingDocumentResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'wrong_application' | 'staff_shared' | 'delete_failed' }

async function deleteUploadedDocumentCore(
  documentId: string,
  applicationUuid: string,
  options: { allowStaffShared: boolean }
): Promise<DeleteCreditFundingDocumentResult> {
  const doc = await getUploadedDocumentById(documentId)
  if (!doc) return { ok: false, reason: 'not_found' }
  if (doc.application_uuid !== applicationUuid) return { ok: false, reason: 'wrong_application' }
  if (!options.allowStaffShared && isStaffSharedDocument(doc)) {
    return { ok: false, reason: 'staff_shared' }
  }

  const { document_type: documentType, storage_path: storagePath } = doc
  const wasApplicantDoc = !isStaffSharedDocument(doc)

  try {
    await deleteCreditFundingStoragePaths([storagePath])
  } catch (err) {
    console.error('deleteUploadedDocumentCore storage error:', err)
  }

  const { error } = await getSupabase()
    .from('uploaded_documents')
    .delete()
    .eq('id', documentId)
    .eq('application_uuid', applicationUuid)

  if (error) {
    console.error('deleteUploadedDocumentCore error:', error)
    return { ok: false, reason: 'delete_failed' }
  }

  if (wasApplicantDoc) {
    const remaining = await getDocumentsByApplicationUuid(applicationUuid)
    const sameTypeRemaining = remaining.filter(
      (d) => d.document_type === documentType && !isStaffSharedDocument(d)
    )
    if (sameTypeRemaining.length === 0) {
      await reopenDocumentRequestForApplication(applicationUuid, documentType)
    }
  }

  return { ok: true }
}

export async function deleteApplicantUploadedDocument(
  documentId: string,
  applicationUuid: string
): Promise<DeleteCreditFundingDocumentResult> {
  return deleteUploadedDocumentCore(documentId, applicationUuid, { allowStaffShared: false })
}

export async function deleteAdminUploadedDocument(
  documentId: string,
  applicationUuid: string
): Promise<DeleteCreditFundingDocumentResult> {
  return deleteUploadedDocumentCore(documentId, applicationUuid, { allowStaffShared: true })
}

export async function linkApplicationToUser(applicationId: string, userId: string, clientId?: string): Promise<boolean> {
  const updates: Record<string, string | null> = { user_id: userId }
  if (clientId) updates.client_id = clientId

  const { data, error } = await getSupabase()
    .from('credit_funding_applications')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', applicationId)
    .is('user_id', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('linkApplicationToUser error:', error)
    return false
  }
  return Boolean(data)
}
