// Service Documents — Agreements and Proposals with e-signature support
// Database operations and business logic for fillable documents
// NOTE: This file imports nodemailer via smtp-mail.ts - only use in server components/routes

import { getSupabase, isSupabaseConfigured } from './supabase'
import { sendEmail, isEmailConfigured, getPublicSiteUrl, escHtml } from './smtp-mail'
import { signCreditFundingPayload, verifyCreditFundingSignature, getCreditFundingSigningSecret } from './credit-funding-signing'
import { getPackageOptionsForAgreement, type PackageOption } from './sales-materials'
import { formatDocumentStatusBadge, type DocumentStatus } from './document-status'

// Re-export for backward compatibility in server code
export { formatDocumentStatusBadge, type DocumentStatus }

export type DocumentType = 'agreement' | 'proposal'

export interface ServiceDocument {
  id: string
  document_type: DocumentType
  status: DocumentStatus
  document_number: string
  
  // Client info
  client_name: string
  client_email: string
  business_name: string
  business_address?: string
  
  // Package selection
  package_tier: string
  package_price: number
  price_type: 'one-time' | 'monthly' | 'custom'
  custom_scope?: string
  
  // Dates
  effective_date?: string
  proposal_valid_until?: string
  
  // Proposal-specific fields
  audit_date?: string
  audit_findings?: AuditFinding[]
  client_goals?: ClientGoal[]
  timeline_phases?: TimelinePhase[]
  investment_items?: InvestmentItem[]
  
  // Signature info
  client_signature?: string
  client_signature_type?: 'typed' | 'drawn'
  client_signed_at?: string
  client_signed_ip?: string
  staff_signature?: string
  staff_signed_at?: string
  
  // Metadata
  created_by: string
  created_at: string
  updated_at: string
  sent_at?: string
  viewed_at?: string
  signed_at?: string
  
  // Access token (hashed)
  access_token_hash?: string
}

export interface AuditFinding {
  area: string
  finding: string
  priority: 'high' | 'medium' | 'low'
  recommendation: string
}

export interface ClientGoal {
  goal: string
  measure: string
  timeframe: string
}

export interface TimelinePhase {
  phase: string
  description: string
  targetDate: string
}

export interface InvestmentItem {
  item: string
  type: 'one-time' | 'monthly'
  amount: number
}

export interface CreateDocumentInput {
  document_type: DocumentType
  client_name: string
  client_email: string
  business_name: string
  business_address?: string
  package_tier: string
  package_price: number
  price_type: 'one-time' | 'monthly' | 'custom'
  custom_scope?: string
  effective_date?: string
  proposal_valid_until?: string
  audit_date?: string
  audit_findings?: AuditFinding[]
  client_goals?: ClientGoal[]
  timeline_phases?: TimelinePhase[]
  investment_items?: InvestmentItem[]
  created_by: string
}

function generateDocumentNumber(type: DocumentType): string {
  const prefix = type === 'agreement' ? 'SA' : 'PR'
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${prefix}-${year}${month}-${random}`
}

function generateAccessToken(): string {
  const bytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hashAccessToken(token: string): string {
  const secret = getCreditFundingSigningSecret('document-access')
  return signCreditFundingPayload(secret, token)
}

function verifyAccessToken(token: string, hash: string): boolean {
  const secret = getCreditFundingSigningSecret('document-access')
  return verifyCreditFundingSignature(secret, token, hash)
}

export async function createServiceDocument(input: CreateDocumentInput): Promise<{ document: ServiceDocument; accessToken: string } | null> {
  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured for service documents')
    return null
  }
  
  const accessToken = generateAccessToken()
  const accessTokenHash = hashAccessToken(accessToken)
  
  const now = new Date().toISOString()
  const documentNumber = generateDocumentNumber(input.document_type)
  
  const document: Omit<ServiceDocument, 'id'> = {
    document_type: input.document_type,
    status: 'draft',
    document_number: documentNumber,
    client_name: input.client_name,
    client_email: input.client_email,
    business_name: input.business_name,
    business_address: input.business_address,
    package_tier: input.package_tier,
    package_price: input.package_price,
    price_type: input.price_type,
    custom_scope: input.custom_scope,
    effective_date: input.effective_date,
    proposal_valid_until: input.proposal_valid_until,
    audit_date: input.audit_date,
    audit_findings: input.audit_findings,
    client_goals: input.client_goals,
    timeline_phases: input.timeline_phases,
    investment_items: input.investment_items,
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
    access_token_hash: accessTokenHash,
  }
  
  const { data, error } = await getSupabase()
    .from('service_documents')
    .insert(document)
    .select()
    .single()
  
  if (error) {
    console.error('Failed to create service document:', error)
    return null
  }
  
  return { document: data as ServiceDocument, accessToken }
}

export async function getServiceDocument(id: string): Promise<ServiceDocument | null> {
  if (!isSupabaseConfigured()) return null
  
  const { data, error } = await getSupabase()
    .from('service_documents')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) return null
  return data as ServiceDocument
}

export async function getServiceDocumentByToken(token: string): Promise<ServiceDocument | null> {
  if (!isSupabaseConfigured()) return null
  
  const tokenHash = hashAccessToken(token)
  
  const { data, error } = await getSupabase()
    .from('service_documents')
    .select('*')
    .eq('access_token_hash', tokenHash)
    .single()
  
  if (error) return null
  return data as ServiceDocument
}

export async function getServiceDocumentsForClient(clientEmail: string): Promise<ServiceDocument[]> {
  if (!isSupabaseConfigured()) return []
  
  const { data, error } = await getSupabase()
    .from('service_documents')
    .select('*')
    .ilike('client_email', clientEmail)
    .order('created_at', { ascending: false })
  
  if (error) return []
  return data as ServiceDocument[]
}

export async function getServiceDocumentsForStaff(options?: {
  status?: DocumentStatus
  type?: DocumentType
  limit?: number
}): Promise<ServiceDocument[]> {
  if (!isSupabaseConfigured()) return []
  
  let query = getSupabase()
    .from('service_documents')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (options?.status) {
    query = query.eq('status', options.status)
  }
  if (options?.type) {
    query = query.eq('document_type', options.type)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }
  
  const { data, error } = await query
  
  if (error) return []
  return data as ServiceDocument[]
}

export async function updateServiceDocument(
  id: string,
  updates: Partial<Omit<ServiceDocument, 'id' | 'created_at' | 'created_by'>>
): Promise<ServiceDocument | null> {
  if (!isSupabaseConfigured()) return null
  
  const { data, error } = await getSupabase()
    .from('service_documents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Failed to update service document:', error)
    return null
  }
  
  return data as ServiceDocument
}

export async function sendDocumentToClient(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email not configured' }
  }
  
  const doc = await getServiceDocument(id)
  if (!doc) {
    return { success: false, error: 'Document not found' }
  }
  
  if (doc.status !== 'draft') {
    return { success: false, error: 'Document has already been sent' }
  }
  
  // Generate new access token for security
  const accessToken = generateAccessToken()
  const accessTokenHash = hashAccessToken(accessToken)
  
  const siteUrl = getPublicSiteUrl()
  const signUrl = `${siteUrl}/sign/${doc.id}?token=${accessToken}`
  
  const docTypeLabel = doc.document_type === 'agreement' ? 'Service Agreement' : 'Marketing Proposal'
  const subject = `${docTypeLabel} from Sunday Harmony - ${doc.document_number}`
  
  const html = `
    <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
        ${escHtml(docTypeLabel)} Ready for Your Review
      </h2>
      <p>Hi ${escHtml(doc.client_name.split(' ')[0])},</p>
      <p>We've prepared a ${docTypeLabel.toLowerCase()} for <strong>${escHtml(doc.business_name)}</strong>.</p>
      <p>Please review the document and sign it electronically when you're ready to proceed.</p>
      ${doc.document_type === 'proposal' && doc.proposal_valid_until ? `
        <p style="color:#666;font-size:14px">This proposal is valid until ${new Date(doc.proposal_valid_until).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
      ` : ''}
      <div style="text-align:center;margin:24px 0">
        <a href="${escHtml(signUrl)}" style="background:#c9a96e;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
          Review & Sign Document
        </a>
      </div>
      <p style="font-size:13px;color:#666">
        If you have any questions, just reply to this email or contact us at sales@sundayharmony.com.
      </p>
      <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
        &mdash; Sunday Harmony Consulting
      </p>
    </div>
  `
  
  try {
    await sendEmail({
      to: doc.client_email,
      subject,
      html,
    })
    
    await updateServiceDocument(id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      access_token_hash: accessTokenHash,
    })
    
    return { success: true }
  } catch (err) {
    console.error('Failed to send document email:', err)
    return { success: false, error: 'Failed to send email' }
  }
}

export async function markDocumentViewed(id: string): Promise<void> {
  const doc = await getServiceDocument(id)
  if (doc && doc.status === 'sent' && !doc.viewed_at) {
    await updateServiceDocument(id, {
      status: 'viewed',
      viewed_at: new Date().toISOString(),
    })
  }
}

export interface SignDocumentInput {
  signature: string
  signatureType: 'typed' | 'drawn'
  clientIp: string
}

export async function signDocument(id: string, input: SignDocumentInput): Promise<{ success: boolean; error?: string }> {
  const doc = await getServiceDocument(id)
  if (!doc) {
    return { success: false, error: 'Document not found' }
  }
  
  if (doc.status === 'signed') {
    return { success: false, error: 'Document has already been signed' }
  }
  
  if (doc.status === 'cancelled' || doc.status === 'expired') {
    return { success: false, error: 'Document is no longer valid' }
  }
  
  const now = new Date().toISOString()
  
  const updated = await updateServiceDocument(id, {
    status: 'signed',
    client_signature: input.signature,
    client_signature_type: input.signatureType,
    client_signed_at: now,
    client_signed_ip: input.clientIp,
    signed_at: now,
  })
  
  if (!updated) {
    return { success: false, error: 'Failed to save signature' }
  }
  
  // Send confirmation emails (fire and forget)
  sendSignatureConfirmationEmails(updated).catch(err => {
    console.error('Failed to send signature confirmation emails:', err)
  })
  
  return { success: true }
}

async function sendSignatureConfirmationEmails(doc: ServiceDocument): Promise<void> {
  if (!isEmailConfigured()) return
  
  const siteUrl = getPublicSiteUrl()
  const docTypeLabel = doc.document_type === 'agreement' ? 'Service Agreement' : 'Marketing Proposal'
  
  // Email to client
  const clientHtml = `
    <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
        ${escHtml(docTypeLabel)} Signed
      </h2>
      <p>Hi ${escHtml(doc.client_name.split(' ')[0])},</p>
      <p>Thank you for signing the ${docTypeLabel.toLowerCase()} for <strong>${escHtml(doc.business_name)}</strong>.</p>
      <p>Document number: <strong>${escHtml(doc.document_number)}</strong></p>
      <p>Signed on: ${new Date(doc.signed_at!).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
      <p>You can view your documents anytime in your client dashboard.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${siteUrl}/dashboard" style="background:#c9a96e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
          View in Dashboard
        </a>
      </div>
      <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
        &mdash; Sunday Harmony Consulting
      </p>
    </div>
  `
  
  await sendEmail({
    to: doc.client_email,
    subject: `${docTypeLabel} Signed - ${doc.document_number}`,
    html: clientHtml,
  }).catch(() => {})
  
  // Email to staff
  const staffHtml = `
    <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">
        ${escHtml(docTypeLabel)} Signed by Client
      </h2>
      <p><strong>${escHtml(doc.client_name)}</strong> has signed the ${docTypeLabel.toLowerCase()}.</p>
      <p><strong>Business:</strong> ${escHtml(doc.business_name)}</p>
      <p><strong>Document:</strong> ${escHtml(doc.document_number)}</p>
      <p><strong>Package:</strong> ${escHtml(doc.package_tier)} - $${doc.package_price.toLocaleString()}${doc.price_type === 'monthly' ? '/mo' : ''}</p>
      <p><strong>Signed:</strong> ${new Date(doc.signed_at!).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${siteUrl}/admin/sales-kit" style="background:#c9a96e;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
          View in Admin
        </a>
      </div>
      <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">
        &mdash; Sunday Harmony (internal)
      </p>
    </div>
  `
  
  const { getAdminNotifyEmail } = await import('./smtp-mail')
  await sendEmail({
    to: getAdminNotifyEmail(),
    subject: `[Signed] ${docTypeLabel} - ${doc.business_name}`,
    html: staffHtml,
  }).catch(() => {})
}

export function getPackageOptions(): PackageOption[] {
  return getPackageOptionsForAgreement()
}

