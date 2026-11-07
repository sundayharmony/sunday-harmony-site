import { createMeeting, getAllMeetings, syncClientFromLead } from '@/lib/crm-db'
import { listScheduledBookings } from '@/lib/consultation-db'
import {
  assembleJoinableMeetings,
  type JoinableMeeting,
  type MeetingProspectRef,
} from '@/lib/joinable-meetings'
import { getCreditFundingApplicationByEmail } from '@/lib/credit-funding-db'
import { emailIlikePattern } from '@/lib/email-match'
import { createClient, getClientById, getTasksByClientIds, logActivity, updateClient, type Client } from '@/lib/db'
import {
  createMeetingEvent,
  createProposalDocument,
  ensureDriveFolder,
  getWorkspaceEvent,
  isGoogleWorkspaceConfigured,
  listWorkspaceEvents,
  type WorkspaceCalendarEvent,
  proposalDocumentText,
  readWorkspaceThread,
  sendWorkspaceEmail,
  uploadDriveFile,
  upsertFollowUpEvent,
  upsertWorkspaceContact,
} from '@/lib/google-workspace'
import { packages as marketingPackages } from '@/lib/data'
import { prospectAgreementCard, prospectMeetingCardState } from '@/lib/prospect-sales-cards'
import { createServiceDocument, getServiceDocumentsForClient, sendDocumentToClient } from '@/lib/service-documents'
import { outreachScripts } from '@/lib/marketing-scripts'
import {
  type LeadSource,
  type MarketingRole,
  type OnboardingChecklist,
  type PipelineStage,
  type ProspectCategory,
  type ScoreFactors,
  canHandOffToRelations,
  canHandOffToSales,
  canMoveStage,
  closerMayBillProspect,
  followUpError,
  isLeadSource,
  isPipelineStage,
  isProspectCategory,
  legacyLeadStatusForStage,
  marketingStatusForStage,
  normalizeOnboarding,
  normalizeScoreFactors,
  onboardingComplete,
  procurementHandoffGaps,
  procurementMetrics,
  relationsMetrics,
  roleCanEditStage,
  roleCanSeeProspect,
  roleMayRunSalesActions,
  salesHandoffGaps,
  salesMetrics,
  stripeHasConfirmedPayment,
  scoreTotal,
  stageAfterConsultation,
  stageFromLegacy,
  stageAfterOutboundEmail,
  stageAfterProspectReply,
} from '@/lib/marketing-pipeline'
import { isMarketingClient } from '@/lib/people'
import { TIER_LIST_PRICES, type PackageTier } from '@/lib/stripe-catalog'
import { getSupabase } from '@/lib/supabase'

export type MarketingActor = {
  role?: string | null
  email?: string | null
  name?: string | null
  userId?: string | null
}

export type MarketingProspect = {
  id: string
  firstName: string
  lastName: string
  contactName: string
  email: string
  phone: string
  business: string
  industry: string
  website: string
  location: string
  category: ProspectCategory | ''
  opportunity: string
  recommendedService: string
  score: number | null
  scoreFactors: ScoreFactors
  source: string
  lastContactedAt: string | null
  followUpAt: string | null
  stage: PipelineStage
  estimatedValue: number | null
  notes: string
  assignedRole: string | null
  gmailThreadId: string | null
  followUpEventId: string | null
  driveFolderId: string | null
  driveFolderUrl: string | null
  proposalDocId: string | null
  proposalDocUrl: string | null
  googleContactId: string | null
  agreementSignedAt: string | null
  paymentStatus: string
  servicesPurchased: string
  scope: string
  deliverables: string
  deadline: string
  promises: string
  expectations: string
  handedToSalesAt: string | null
  handedToRelationsAt: string | null
  onboarding: OnboardingChecklist
  clientId: string | null
  createdAt: string
  creditApplicationId: string | null
  closeMethod: string | null
}

type LeadRow = Record<string, unknown>

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function stageOf(row: LeadRow): PipelineStage {
  const raw = text(row.pipeline_stage)
  if (isPipelineStage(raw)) return raw
  return stageFromLegacy({
    marketingStatus: text(row.marketing_lead_status),
    legacyStatus: text(row.status),
    source: text(row.source),
  })
}

export function mapProspect(row: LeadRow, creditApplicationId: string | null = null): MarketingProspect {
  const firstName = text(row.first_name)
  const lastName = text(row.last_name)
  const category = text(row.prospect_category)
  const score = row.prospect_score
  return {
    id: text(row.id),
    firstName,
    lastName,
    contactName: [firstName, lastName].filter(Boolean).join(' '),
    email: text(row.email),
    phone: text(row.phone),
    business: text(row.business),
    industry: text(row.industry),
    website: text(row.website),
    location: text(row.location_text),
    category: isProspectCategory(category) ? category : '',
    opportunity: text(row.marketing_opportunity),
    recommendedService: text(row.recommended_service) || text(row.service),
    score: typeof score === 'number' ? score : score == null || score === '' ? null : Number(score),
    scoreFactors: normalizeScoreFactors(row.score_factors),
    source: text(row.source) || 'outbound',
    lastContactedAt: text(row.last_contacted_at) || null,
    followUpAt: text(row.follow_up_at) || null,
    stage: stageOf(row),
    estimatedValue: row.estimated_value == null || row.estimated_value === '' ? null : Number(row.estimated_value),
    notes: text(row.notes),
    assignedRole: text(row.assigned_role) || null,
    gmailThreadId: text(row.gmail_thread_id) || null,
    followUpEventId: text(row.follow_up_event_id) || null,
    driveFolderId: text(row.drive_folder_id) || null,
    driveFolderUrl: text(row.drive_folder_url) || null,
    proposalDocId: text(row.proposal_doc_id) || null,
    proposalDocUrl: text(row.proposal_doc_url) || null,
    googleContactId: text(row.google_contact_id) || null,
    agreementSignedAt: text(row.agreement_signed_at) || null,
    paymentStatus: text(row.payment_status),
    servicesPurchased: text(row.services_purchased),
    scope: text(row.scope_text),
    deliverables: text(row.deliverables_text),
    deadline: text(row.deadline_text),
    promises: text(row.promises),
    expectations: text(row.expectations),
    handedToSalesAt: text(row.handed_to_sales_at) || null,
    handedToRelationsAt: text(row.handed_to_relations_at) || null,
    onboarding: normalizeOnboarding(row.onboarding),
    clientId: text(row.client_id) || null,
    createdAt: text(row.created_at),
    creditApplicationId,
    closeMethod: text(row.close_method) || null,
  }
}

function isMarketingRow(row: LeadRow): boolean {
  const type = text(row.lead_type) || 'marketing_lead'
  return type === 'marketing_lead' || type === 'existing_client' || type === 'completed_client'
}

async function loadRows(): Promise<LeadRow[]> {
  const { data, error } = await getSupabase().from('leads').select('*').order('updated_at', { ascending: false })
  if (error) {
    console.error('marketing prospects error:', error)
    return []
  }
  return ((data || []) as LeadRow[]).filter(isMarketingRow)
}

export function prospectVisibleToRole(prospect: MarketingProspect, role?: string | null): boolean {
  return roleCanSeeProspect(role, prospect)
}

export async function listMarketingProspects(role?: string | null): Promise<MarketingProspect[]> {
  const rows = await loadRows()
  return rows.map((row) => mapProspect(row)).filter((prospect) => prospectVisibleToRole(prospect, role))
}

export async function getMarketingProspect(id: string): Promise<MarketingProspect | null> {
  const { data, error } = await getSupabase().from('leads').select('*').eq('id', id).maybeSingle()
  if (error || !data || !isMarketingRow(data as LeadRow)) return null
  const row = data as LeadRow
  let creditApplicationId: string | null = null
  const email = text(row.email)
  if (email) {
    const application = await getCreditFundingApplicationByEmail(email)
    creditApplicationId = application?.id || null
  }
  return mapProspect(row, creditApplicationId)
}

function splitContact(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/)
  return { first: parts[0] || '', last: parts.slice(1).join(' ') }
}

export type ProspectInput = {
  business?: string
  contactName?: string
  email?: string
  phone?: string
  industry?: string
  website?: string
  location?: string
  category?: string
  opportunity?: string
  recommendedService?: string
  scoreFactors?: unknown
  source?: string
  followUpAt?: string | null
  stage?: string
  estimatedValue?: number | string | null
  notes?: string
  servicesPurchased?: string
  scope?: string
  deliverables?: string
  deadline?: string
  promises?: string
  expectations?: string
  paymentStatus?: string
  agreementSigned?: boolean
  proposalDocUrl?: string | null
  closeMethod?: string | null
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function saveMarketingProspect(
  id: string | null,
  input: ProspectInput,
  actor: MarketingActor
): Promise<{ prospect: MarketingProspect; warning?: string }> {
  const existing = id ? await getMarketingProspect(id) : null
  if (id && !existing) throw new Error('Prospect not found')
  if (existing && !prospectVisibleToRole(existing, actor.role)) throw new Error('You cannot edit this prospect')
  if (existing && actor.role !== 'admin' && !roleCanEditStage(actor.role, existing.stage)) {
    throw new Error('You cannot edit this prospect')
  }

  const stage = isPipelineStage(input.stage) ? input.stage : existing?.stage || 'researching'
  if (existing && !canMoveStage(actor.role, existing.stage, stage)) {
    throw new Error('That stage belongs to the next role')
  }
  if (!existing && !roleCanEditStage(actor.role, stage) && actor.role !== 'admin') {
    throw new Error('You cannot create a prospect in that stage')
  }

  const followUpAt = input.followUpAt === undefined ? existing?.followUpAt || null : input.followUpAt || null
  const followUpProblem = followUpError(stage, followUpAt)
  if (followUpProblem) throw new Error(followUpProblem)

  const factors = input.scoreFactors === undefined ? existing?.scoreFactors : normalizeScoreFactors(input.scoreFactors)
  const score = factors ? scoreTotal(factors) : existing?.score
  const source = clean(input.source) || existing?.source || 'outbound'
  if (!isLeadSource(source)) throw new Error('Choose a lead source')
  const business = clean(input.business) || existing?.business || ''
  if (!business) throw new Error('Business name is required')
  const contactSource = input.contactName === undefined ? existing?.contactName || '' : clean(input.contactName)
  const contact = splitContact(contactSource)
  const categoryInput = clean(input.category) || existing?.category || ''
  if (categoryInput && !isProspectCategory(categoryInput)) throw new Error('Prospect category must be established, small, or startup')

  const estimated =
    input.estimatedValue === undefined || input.estimatedValue === null || input.estimatedValue === ''
      ? existing?.estimatedValue ?? null
      : Number(input.estimatedValue)

  const payload: Record<string, unknown> = {
    first_name: contact.first,
    last_name: contact.last,
    email: input.email === undefined ? existing?.email || null : clean(input.email) || null,
    phone: input.phone === undefined ? existing?.phone || null : clean(input.phone) || null,
    business,
    industry: input.industry === undefined ? existing?.industry || null : clean(input.industry) || null,
    website: input.website === undefined ? existing?.website || null : clean(input.website) || null,
    location_text: input.location === undefined ? existing?.location || null : clean(input.location) || null,
    prospect_category: categoryInput || null,
    marketing_opportunity: input.opportunity === undefined ? existing?.opportunity || '' : clean(input.opportunity),
    recommended_service: input.recommendedService === undefined ? existing?.recommendedService || '' : clean(input.recommendedService),
    service: input.recommendedService === undefined ? existing?.recommendedService || '' : clean(input.recommendedService),
    score_factors: factors || {},
    prospect_score: score,
    source: source as LeadSource,
    follow_up_at: followUpAt,
    pipeline_stage: stage,
    marketing_lead_status: marketingStatusForStage(stage),
    status: legacyLeadStatusForStage(stage),
    estimated_value: Number.isFinite(estimated as number) ? estimated : null,
    notes: input.notes === undefined ? existing?.notes || '' : clean(input.notes),
    lead_type: existing ? undefined : 'marketing_lead',
    assigned_role: existing?.assignedRole || (actor.role && actor.role !== 'admin' ? actor.role : 'lead_procurement'),
    services_purchased: input.servicesPurchased === undefined ? existing?.servicesPurchased || '' : clean(input.servicesPurchased),
    scope_text: input.scope === undefined ? existing?.scope || '' : clean(input.scope),
    deliverables_text: input.deliverables === undefined ? existing?.deliverables || '' : clean(input.deliverables),
    deadline_text: input.deadline === undefined ? existing?.deadline || '' : clean(input.deadline),
    promises: input.promises === undefined ? existing?.promises || '' : clean(input.promises),
    expectations: input.expectations === undefined ? existing?.expectations || '' : clean(input.expectations),
    payment_status: input.paymentStatus === undefined ? existing?.paymentStatus || '' : clean(input.paymentStatus),
    agreement_signed_at:
      input.agreementSigned === undefined
        ? existing?.agreementSignedAt || null
        : input.agreementSigned
          ? existing?.agreementSignedAt || new Date().toISOString()
          : null,
    proposal_doc_url:
      input.proposalDocUrl === undefined ? existing?.proposalDocUrl || null : clean(input.proposalDocUrl) || null,
    close_method:
      input.closeMethod === undefined
        ? existing?.closeMethod || null
        : input.closeMethod ? 'nonstandard' : null,
    updated_at: new Date().toISOString(),
  }
  if (
    existing &&
    actor.role === 'sales_closer' &&
    !existing.handedToSalesAt &&
    existing.stage === 'ready_to_contact' &&
    stage !== 'ready_to_contact'
  ) {
    const now = new Date().toISOString()
    payload.handed_to_sales_at = now
    payload.assigned_role = 'sales_closer'
    payload.last_contacted_at = existing.lastContactedAt || now
  }
  if (payload.lead_type === undefined) delete payload.lead_type

  const table = getSupabase().from('leads')
  const write = id
    ? await table.update(payload).eq('id', id).select('*').single()
    : await table.insert(payload).select('*').single()
  if (write.error || !write.data) {
    console.error('save marketing prospect error:', write.error)
    throw new Error('Could not save the prospect. Run the marketing CRM migration if this is a new database.')
  }

  let warning: string | undefined
  let saved = mapProspect(write.data as LeadRow)
  if (isGoogleWorkspaceConfigured()) {
    try {
      const synced = await syncWorkspace(saved)
      if (synced) saved = synced
    } catch (error) {
      console.error('workspace sync error:', error)
      warning = error instanceof Error ? error.message : 'Saved in the CRM. Google Workspace did not update.'
    }
  }

  logActivity({
    action: id ? 'status_changed' : 'lead_created',
    entity_type: 'lead',
    entity_id: saved.id,
    actor_email: actor.email || 'staff',
    details: `${id ? 'Updated' : 'Created'} marketing prospect ${saved.business} (${saved.stage})`,
  })
  return { prospect: saved, warning }
}

async function syncWorkspace(prospect: MarketingProspect): Promise<MarketingProspect | null> {
  const updates: Record<string, unknown> = {}
  if (prospect.followUpAt && prospect.stage !== 'meeting_scheduled') {
    const event = await upsertFollowUpEvent({
      eventId: prospect.followUpEventId,
      summary: `Follow up: ${prospect.business}`,
      description: `${prospect.contactName}\n${prospect.opportunity || prospect.notes || ''}`.trim(),
      startsAt: new Date(prospect.followUpAt),
    })
    updates.follow_up_event_id = event.eventId
  }
  if (prospect.email || prospect.phone) {
    const contact = splitContact(prospect.contactName || prospect.business)
    updates.google_contact_id = await upsertWorkspaceContact({
      resourceName: prospect.googleContactId,
      givenName: contact.first || prospect.business,
      familyName: contact.last,
      email: prospect.email || undefined,
      phone: prospect.phone || undefined,
      business: prospect.business,
    })
  }
  if (Object.keys(updates).length === 0) return null
  const { data, error } = await getSupabase().from('leads').update(updates).eq('id', prospect.id).select('*').single()
  if (error || !data) return null
  return mapProspect(data as LeadRow, prospect.creditApplicationId)
}

function deliverableList(value: string): string[] {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
}

function clientNotes(prospect: MarketingProspect): string {
  return [
    prospect.expectations ? `Expectations: ${prospect.expectations}` : '',
    prospect.scope ? `Scope: ${prospect.scope}` : '',
    prospect.promises ? `Promises: ${prospect.promises}` : '',
    prospect.notes,
  ].filter(Boolean).join('\n')
}

function marketingPackageFor(prospect: MarketingProspect): { package_tier: Exclude<PackageTier, 'free'>; monthly_price: number } {
  const haystack = `${prospect.servicesPurchased} ${prospect.recommendedService}`.toLowerCase()
  if (haystack.includes('scale')) return { package_tier: 'scale', monthly_price: TIER_LIST_PRICES.scale }
  if (haystack.includes('growth')) return { package_tier: 'growth', monthly_price: TIER_LIST_PRICES.growth }
  if (haystack.includes('social')) return { package_tier: 'social_essentials', monthly_price: TIER_LIST_PRICES.social_essentials }
  return { package_tier: 'spark', monthly_price: TIER_LIST_PRICES.spark }
}

async function ensureMarketingClient(
  prospect: MarketingProspect,
  purpose: 'handoff' | 'billing' = 'handoff'
): Promise<{ id: string; created: boolean }> {
  if (prospect.clientId) return { id: prospect.clientId, created: false }
  if (!prospect.email.trim()) {
    throw new Error(
      purpose === 'billing'
        ? 'Add an email before billing this client'
        : 'Add an email before handing to client relations'
    )
  }
  const existing = await getSupabase()
    .from('clients')
    .select('*')
    .ilike('email', emailIlikePattern(prospect.email))
    .limit(1)
  if (existing.error) throw new Error('Could not open the client file')
  const found = Array.isArray(existing.data) ? existing.data[0] : null
  if (found?.id) {
    if (!isMarketingClient(found)) throw new Error('This email belongs to a credit repair client')
    return { id: String(found.id), created: false }
  }

  const plan = marketingPackageFor(prospect)
  const created = await createClient({
    name: prospect.contactName || prospect.business,
    business: prospect.business,
    email: prospect.email,
    phone: prospect.phone,
    industry: prospect.industry,
    package_tier: plan.package_tier,
    monthly_price: plan.monthly_price,
    start_date: new Date().toISOString(),
    status: 'active',
    is_potential: false,
    billing_status: 'not_started',
    billing_model: 'marketing_subscription',
    notes: clientNotes(prospect),
    deliverables: deliverableList(prospect.deliverables),
    quick_wins: [],
    lead_type: 'marketing_lead',
  })
  if (!created) throw new Error('Could not open the client file')
  return { id: created.id, created: true }
}

async function requireActiveProspect(id: string, actor: MarketingActor): Promise<MarketingProspect> {
  const prospect = await getMarketingProspect(id)
  if (!prospect) throw new Error('Prospect not found')
  if (actor.role !== 'admin' && actor.role !== 'sales_closer') throw new Error('Forbidden')
  if (!prospectVisibleToRole(prospect, actor.role)) throw new Error('Prospect not found')
  if (prospect.stage !== 'won') throw new Error('Move the prospect to Active before billing')
  return prospect
}

async function linkProspectClient(prospectId: string, clientId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await getSupabase().from('leads').update({ client_id: clientId, updated_at: now }).eq('id', prospectId)
  if (error) throw new Error('Could not link the client file')
  await syncClientFromLead(prospectId, clientId)
}

export async function salesCloserOwnsClient(clientId: string): Promise<boolean> {
  if (!clientId.trim()) return false
  const client = await getClientById(clientId)
  if (!client || !isMarketingClient(client)) return false
  const { data, error } = await getSupabase().from('leads').select('*').eq('client_id', clientId)
  if (error || !Array.isArray(data)) return false
  return data.some((row) => closerMayBillProspect('sales_closer', mapProspect(row as LeadRow), true))
}

export async function stripePaidForProspect(prospect: { clientId: string | null }): Promise<boolean> {
  if (!prospect.clientId) return false
  const client = await getClientById(prospect.clientId)
  return stripeHasConfirmedPayment(client)
}

export async function readProspectBilling(
  id: string,
  actor: MarketingActor
): Promise<{ prospect: MarketingProspect; client: Client | null }> {
  const prospect = await requireActiveProspect(id, actor)
  if (!prospect.clientId) return { prospect, client: null }
  const client = await getClientById(prospect.clientId)
  if (!client || !isMarketingClient(client)) throw new Error('This file is not a marketing client')
  return { prospect, client }
}

export async function openProspectForBilling(
  id: string,
  actor: MarketingActor
): Promise<{ prospect: MarketingProspect; client: Client }> {
  const prospect = await requireActiveProspect(id, actor)
  const clientFile = await ensureMarketingClient(prospect, 'billing')
  const alreadyLinked = prospect.clientId === clientFile.id
  if (!alreadyLinked) await linkProspectClient(id, clientFile.id)
  const client = await getClientById(clientFile.id)
  if (!client || !isMarketingClient(client)) throw new Error('This file is not a marketing client')
  if (!alreadyLinked) {
    await logActivity({
      action: 'updated',
      entity_type: 'client',
      entity_id: client.id,
      actor_email: actor.email || '',
      details: `Opened billing for ${prospect.business}`,
    })
  }
  const saved = await getMarketingProspect(id)
  if (!saved) throw new Error('Prospect not found')
  return { prospect: saved, client }
}

export async function handOffProspect(
  id: string,
  target: 'sales_closer' | 'client_relations',
  actor: MarketingActor
): Promise<MarketingProspect> {
  const prospect = await getMarketingProspect(id)
  if (!prospect) throw new Error('Prospect not found')
  if (target === 'sales_closer') {
    if (!canHandOffToSales(actor.role, prospect.stage)) throw new Error('This prospect is not ready to hand to sales')
    const gaps = procurementHandoffGaps({
      businessName: prospect.business,
      decisionMaker: prospect.contactName,
      email: prospect.email,
      phone: prospect.phone,
      marketingOpportunity: prospect.opportunity,
      leadSource: prospect.source,
      notes: prospect.notes,
      score: prospect.score,
    })
    if (gaps.length) throw new Error(`Still needed: ${gaps.join(', ')}`)
  } else {
    if (!canHandOffToRelations(actor.role, prospect.stage)) {
      throw new Error('Move the prospect to Active before handing it to client relations')
    }
    const stripePaid = await stripePaidForProspect(prospect)
    const gaps = salesHandoffGaps({
      servicesPurchased: prospect.servicesPurchased,
      scope: prospect.scope,
      deliverables: prospect.deliverables,
      deadline: prospect.deadline,
      promises: prospect.promises,
      expectations: prospect.expectations,
      agreementSigned: Boolean(prospect.agreementSignedAt),
      paymentStatus: prospect.paymentStatus,
      proposalUrl: prospect.proposalDocUrl,
      stripePaid,
      lastContactedAt: prospect.lastContactedAt,
      handedToSalesAt: prospect.handedToSalesAt,
    })
    if (!prospect.email.trim()) gaps.push('Email')
    if (gaps.length) throw new Error(`Still needed: ${gaps.join(', ')}`)
  }

  let driveFolderId = prospect.driveFolderId
  let driveFolderUrl = prospect.driveFolderUrl
  if (target === 'client_relations' && isGoogleWorkspaceConfigured()) {
    const folder = await ensureDriveFolder({ name: prospect.business, existingId: prospect.driveFolderId })
    driveFolderId = folder.id
    driveFolderUrl = folder.url
  }

  const clientFile = target === 'client_relations' ? await ensureMarketingClient(prospect) : null
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    assigned_role: target,
    drive_folder_id: driveFolderId,
    drive_folder_url: driveFolderUrl,
    updated_at: now,
    ...(clientFile ? { client_id: clientFile.id } : {}),
    ...(target === 'sales_closer' ? { handed_to_sales_at: now } : { handed_to_relations_at: now }),
  }
  const { error } = await getSupabase().from('leads').update(updates).eq('id', id)
  if (error) throw new Error('Could not save the handoff')
  const handoffLog = await getSupabase().from('marketing_handoffs').insert({
    lead_id: id,
    from_role: actor.role || 'admin',
    to_role: target,
    checklist: target === 'sales_closer'
      ? { business: prospect.business, opportunity: prospect.opportunity, score: prospect.score, source: prospect.source }
      : { services: prospect.servicesPurchased, payment: prospect.paymentStatus, proposal: prospect.proposalDocUrl },
    notes: prospect.notes,
    created_by: actor.email || '',
  })
  if (handoffLog.error) throw new Error('Could not save the handoff')
  if (clientFile) {
    await syncClientFromLead(id, clientFile.id)
    await updateClient(clientFile.id, {
      drive_folder_id: driveFolderId,
      drive_folder_url: driveFolderUrl,
      onboarding: prospect.onboarding,
      relations_notes: prospect.notes,
      ...(clientFile.created
        ? {
            notes: clientNotes(prospect),
            deliverables: deliverableList(prospect.deliverables),
          }
        : {}),
    })
  }
  const saved = await getMarketingProspect(id)
  if (!saved) throw new Error('Prospect not found after handoff')
  return saved
}

export async function sendProspectEmail(
  id: string,
  input: { subject: string; body: string },
  actor: MarketingActor
): Promise<MarketingProspect> {
  const prospect = await getMarketingProspect(id)
  if (!prospect) throw new Error('Prospect not found')
  if (!roleCanEditStage(actor.role, prospect.stage) && actor.role !== 'admin') throw new Error('You cannot email this prospect')
  if (!prospect.email) throw new Error('Add an email address before sending')
  if (!isGoogleWorkspaceConfigured()) throw new Error('Google Workspace is not connected')
  const sent = await sendWorkspaceEmail({
    to: prospect.email,
    subject: input.subject.trim(),
    body: input.body,
    threadId: prospect.gmailThreadId,
  })
  const stage = stageAfterOutboundEmail(prospect.stage)
  const now = new Date().toISOString()
  const claim =
    actor.role === 'sales_closer' && !prospect.handedToSalesAt
      ? { handed_to_sales_at: now, assigned_role: 'sales_closer' }
      : {}
  const { error } = await getSupabase()
    .from('leads')
    .update({
      gmail_thread_id: sent.threadId,
      last_contacted_at: now,
      pipeline_stage: stage,
      marketing_lead_status: marketingStatusForStage(stage),
      status: legacyLeadStatusForStage(stage),
      updated_at: now,
      ...claim,
    })
    .eq('id', id)
  if (error) throw new Error('Email sent, but the CRM could not store the thread')
  const saved = await getMarketingProspect(id)
  if (!saved) throw new Error('Prospect not found')
  return saved
}

export async function checkProspectReplies(id: string): Promise<{ prospect: MarketingProspect; replied: boolean; messages: { from: string; date: string; snippet: string }[] }> {
  const prospect = await getMarketingProspect(id)
  if (!prospect) throw new Error('Prospect not found')
  if (!prospect.gmailThreadId) throw new Error('No Gmail thread yet')
  if (!isGoogleWorkspaceConfigured()) throw new Error('Google Workspace is not connected')
  const thread = await readWorkspaceThread(prospect.gmailThreadId, prospect.email)
  let current = prospect
  if (thread.replied) {
    const stage = stageAfterProspectReply(prospect.stage)
    if (stage) {
      await getSupabase()
        .from('leads')
        .update({
          pipeline_stage: stage,
          marketing_lead_status: marketingStatusForStage(stage),
          status: legacyLeadStatusForStage(stage),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      current = (await getMarketingProspect(id)) || prospect
    }
  }
  return { prospect: current, replied: thread.replied, messages: thread.messages }
}

export async function createProspectProposal(
  id: string,
  input: { service?: string; price?: string; scope?: string; deadline?: string },
  actor: MarketingActor
): Promise<MarketingProspect> {
  const prospect = await getMarketingProspect(id)
  if (!prospect) throw new Error('Prospect not found')
  if (actor.role !== 'admin' && actor.role !== 'sales_closer') throw new Error('Sales creates the proposal')
  if (!isGoogleWorkspaceConfigured()) throw new Error('Google Workspace is not connected')
  const folder = await ensureDriveFolder({ name: prospect.business, existingId: prospect.driveFolderId })
  const service = clean(input.service) || prospect.recommendedService
  const price = clean(input.price) || (prospect.estimatedValue != null ? String(prospect.estimatedValue) : '')
  const scope = clean(input.scope) || prospect.scope
  const deadline = clean(input.deadline) || prospect.deadline
  const doc = await createProposalDocument({
    title: `Proposal — ${prospect.business}`,
    folderId: folder.id,
    text: proposalDocumentText({
      business: prospect.business,
      contactName: prospect.contactName,
      service,
      price,
      scope,
      deadline,
    }),
  })
  const stage: PipelineStage = prospect.stage === 'won' || prospect.stage === 'negotiation' ? prospect.stage : 'proposal_sent'
  const { error } = await getSupabase()
    .from('leads')
    .update({
      drive_folder_id: folder.id,
      drive_folder_url: folder.url,
      proposal_doc_id: doc.id,
      proposal_doc_url: doc.url,
      recommended_service: service,
      scope_text: scope,
      deadline_text: deadline,
      estimated_value: Number(price.replace(/[^0-9.]/g, '')) || prospect.estimatedValue,
      pipeline_stage: stage,
      marketing_lead_status: marketingStatusForStage(stage),
      status: legacyLeadStatusForStage(stage),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error('The Doc was created, but the CRM could not store the link')
  const saved = await getMarketingProspect(id)
  if (!saved) throw new Error('Prospect not found')
  return saved
}

export async function uploadProspectFile(
  id: string,
  file: { name: string; mimeType: string; data: Buffer }
): Promise<MarketingProspect> {
  const prospect = await getMarketingProspect(id)
  if (!prospect) throw new Error('Prospect not found')
  if (!isGoogleWorkspaceConfigured()) throw new Error('Google Workspace is not connected')
  const folder = await ensureDriveFolder({ name: prospect.business, existingId: prospect.driveFolderId })
  await uploadDriveFile({ folderId: folder.id, name: file.name, mimeType: file.mimeType, data: file.data })
  await getSupabase()
    .from('leads')
    .update({ drive_folder_id: folder.id, drive_folder_url: folder.url, updated_at: new Date().toISOString() })
    .eq('id', id)
  const saved = await getMarketingProspect(id)
  if (!saved) throw new Error('Prospect not found')
  return saved
}

function packagePriceAmount(tier: string): { price: number; priceType: 'one-time' | 'monthly' | 'custom'; scope: string } {
  const pkg = marketingPackages.find((row) => row.tier === tier)
  if (!pkg) {
    return { price: 0, priceType: 'custom', scope: '' }
  }
  const price =
    pkg.price != null
      ? pkg.price
      : Number((pkg.priceLabel || '').replace(/[^0-9.]/g, '')) || 0
  const priceType =
    pkg.priceSuffix === 'monthly' ? 'monthly' : pkg.priceSuffix === 'one-time' ? 'one-time' : 'custom'
  const scope = pkg.features.filter((feature) => feature.included).map((feature) => feature.text).join('; ')
  return { price, priceType, scope }
}

export async function scheduleProspectMeeting(
  id: string,
  input: { startsAt: string; durationMinutes?: number; notes?: string },
  actor: MarketingActor
): Promise<{ prospect: MarketingProspect; htmlLink: string; meetLink: string; meetings: JoinableMeeting[] }> {
  if (!roleMayRunSalesActions(actor.role)) throw new Error('Only sales can schedule meetings')
  const prospect = await getMarketingProspect(id)
  if (!prospect) throw new Error('Prospect not found')
  if (!prospectVisibleToRole(prospect, actor.role)) throw new Error('You cannot edit this prospect')
  if (!isGoogleWorkspaceConfigured()) throw new Error('Google Workspace is not connected')

  const startsAt = new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) throw new Error('Choose a valid meeting time')
  const durationMinutes = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 30
  const notes = clean(input.notes)
  const description = [
    prospect.contactName ? `Contact: ${prospect.contactName}` : '',
    prospect.email ? `Email: ${prospect.email}` : '',
    prospect.phone ? `Phone: ${prospect.phone}` : '',
    prospect.opportunity || '',
    notes,
  ].filter(Boolean).join('\n')

  const event = await createMeetingEvent({
    summary: `Meeting: ${prospect.business}`,
    description,
    startsAt,
    durationMinutes,
    attendeeEmail: prospect.email || null,
  })

  const nextStage = stageAfterConsultation(prospect.stage) || prospect.stage
  const { error } = await getSupabase()
    .from('leads')
    .update({
      pipeline_stage: nextStage,
      marketing_lead_status: marketingStatusForStage(nextStage),
      status: legacyLeadStatusForStage(nextStage),
      follow_up_at: startsAt.toISOString(),
      follow_up_event_id: event.eventId,
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error('The meeting was created, but the CRM could not update the prospect')

  const saved = await getMarketingProspect(id)
  if (!saved) throw new Error('Prospect not found')

  const meeting = await createMeeting({
    client_id: saved.clientId,
    lead_id: id,
    application_uuid: null,
    title: `Meeting: ${saved.business}`,
    meeting_type: 'consultation',
    scheduled_at: startsAt.toISOString(),
    duration_minutes: durationMinutes,
    notes,
    assigned_staff: actor.email || null,
    google_meet_link: event.meetLink,
    status: 'scheduled',
    created_by: actor.email || 'sales',
  })

  const meetings = await listJoinableMeetings([{
    id,
    business: saved.business,
    stage: saved.stage,
    followUpAt: saved.followUpAt,
    followUpEventId: saved.followUpEventId,
  }])
  if (!meetings.some((row) => row.meetLink === event.meetLink)) {
    meetings.unshift({
      id: meeting?.id || event.eventId,
      prospectId: id,
      business: saved.business,
      title: `Meeting: ${saved.business}`,
      startsAt: startsAt.toISOString(),
      meetLink: event.meetLink,
    })
  }

  logActivity({
    action: 'status_changed',
    entity_type: 'lead',
    entity_id: id,
    actor_email: actor.email || 'staff',
    details: `Scheduled meeting for ${saved.business}`,
  })
  return { prospect: saved, htmlLink: event.htmlLink, meetLink: event.meetLink, meetings }
}

export async function sendProspectAgreement(
  id: string,
  input: { packageTier?: string; packagePrice?: number; priceType?: string; customScope?: string },
  actor: MarketingActor
): Promise<{ prospect: MarketingProspect; documentId: string; documentNumber: string }> {
  if (!roleMayRunSalesActions(actor.role)) throw new Error('Only sales can send agreements')
  const prospect = await getMarketingProspect(id)
  if (!prospect) throw new Error('Prospect not found')
  if (!prospectVisibleToRole(prospect, actor.role)) throw new Error('You cannot edit this prospect')
  if (!prospect.email.trim()) throw new Error('Add an email before sending an agreement')
  if (!prospect.contactName.trim()) throw new Error('Add a contact name before sending an agreement')

  const tier = clean(input.packageTier) || clean(prospect.servicesPurchased) || clean(prospect.recommendedService)
  if (!tier) throw new Error('Choose a package for the agreement')
  const defaults = packagePriceAmount(tier)
  const price = input.packagePrice != null && Number.isFinite(input.packagePrice) ? Number(input.packagePrice) : defaults.price
  const priceType =
    input.priceType === 'monthly' || input.priceType === 'one-time' || input.priceType === 'custom'
      ? input.priceType
      : defaults.priceType
  const scope = clean(input.customScope) || clean(prospect.scope) || defaults.scope

  const created = await createServiceDocument({
    document_type: 'agreement',
    client_name: prospect.contactName,
    client_email: prospect.email,
    business_name: prospect.business,
    package_tier: tier,
    package_price: price,
    price_type: priceType,
    custom_scope: scope || undefined,
    effective_date: new Date().toISOString().slice(0, 10),
    created_by: actor.userId || actor.email || 'sales',
  })
  if (!created) throw new Error('Could not create the agreement')

  const sent = await sendDocumentToClient(created.document.id)
  if (!sent.success) throw new Error(sent.error || 'Could not email the agreement')

  const stage: PipelineStage =
    prospect.stage === 'won' || prospect.stage === 'negotiation' ? prospect.stage : 'proposal_sent'
  const signHint = `Agreement ${created.document.document_number}`

  const { error } = await getSupabase()
    .from('leads')
    .update({
      services_purchased: tier,
      scope_text: scope || prospect.scope,
      estimated_value: price || prospect.estimatedValue,
      proposal_doc_url: signHint,
      pipeline_stage: stage,
      marketing_lead_status: marketingStatusForStage(stage),
      status: legacyLeadStatusForStage(stage),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error('Agreement emailed, but the CRM could not store the link')

  const saved = await getMarketingProspect(id)
  if (!saved) throw new Error('Prospect not found')
  logActivity({
    action: 'status_changed',
    entity_type: 'lead',
    entity_id: id,
    actor_email: actor.email || 'staff',
    details: `Sent agreement ${created.document.document_number} to ${saved.business}`,
  })
  return {
    prospect: saved,
    documentId: created.document.id,
    documentNumber: created.document.document_number,
  }
}

export async function updateProspectOnboarding(
  id: string,
  input: { onboarding?: unknown; expectations?: string; notes?: string },
  actor: MarketingActor
): Promise<MarketingProspect> {
  if (actor.role !== 'admin' && actor.role !== 'client_relations') {
    throw new Error('Client relations updates onboarding')
  }
  const prospect = await getMarketingProspect(id)
  if (!prospect || prospect.stage !== 'won') throw new Error('Onboarding starts after the sale')
  const onboarding = input.onboarding === undefined ? prospect.onboarding : normalizeOnboarding(input.onboarding)
  const { error } = await getSupabase()
    .from('leads')
    .update({
      onboarding,
      expectations: input.expectations === undefined ? prospect.expectations : clean(input.expectations),
      notes: input.notes === undefined ? prospect.notes : clean(input.notes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error('Could not save onboarding')
  if (prospect.clientId) {
    await updateClient(prospect.clientId, {
      onboarding,
      relations_notes: input.notes === undefined ? undefined : clean(input.notes),
    })
  }
  const saved = await getMarketingProspect(id)
  if (!saved) throw new Error('Prospect not found')
  return saved
}

export function scriptsForProspect(prospect: MarketingProspect, actor: MarketingActor) {
  return outreachScripts({
    business: prospect.business,
    contactName: prospect.contactName,
    senderName: actor.name || 'Sunday Harmony',
  })
}

function attentionHref(prospect: MarketingProspect, role?: string | null): string {
  if (role === 'client_relations') return '/admin/clients'
  if (prospect.stage === 'won' && prospect.handedToRelationsAt) return '/admin/clients'
  return `/admin/pipeline/${prospect.id}`
}

export async function loadMarketingToday(role?: string | null) {
  const everyone = await listMarketingProspects('admin')
  const prospects = !role || role === 'admin'
    ? everyone
    : everyone.filter((prospect) => prospectVisibleToRole(prospect, role))
  const now = Date.now()
  const week = now + 7 * 24 * 60 * 60 * 1000
  const followUps = prospects
    .filter((prospect) => prospect.followUpAt && new Date(prospect.followUpAt).getTime() <= week)
    .filter((prospect) => prospect.stage !== 'won' && prospect.stage !== 'lost_nurture')
    .slice(0, 12)
    .map((prospect) => ({
      id: prospect.id,
      business: prospect.business,
      followUpAt: prospect.followUpAt,
      stage: prospect.stage,
    }))
  const handoffs = prospects
    .filter((prospect) => {
      if (role === 'sales_closer') {
        return (
          prospect.stage === 'ready_to_contact' ||
          (prospect.stage === 'contacted' && Boolean(prospect.handedToSalesAt || prospect.lastContactedAt))
        )
      }
      if (role === 'client_relations') return prospect.stage === 'won' && !onboardingComplete(prospect.onboarding)
      if (role === 'lead_procurement') return prospect.stage === 'researching' || prospect.stage === 'ready_to_contact'
      return (
        (Boolean(prospect.handedToSalesAt) && (prospect.stage === 'ready_to_contact' || prospect.stage === 'contacted'))
        || (prospect.stage === 'won' && !prospect.handedToRelationsAt)
        || (prospect.stage === 'won' && Boolean(prospect.handedToRelationsAt) && !onboardingComplete(prospect.onboarding))
      )
    })
    .slice(0, 12)
    .map((prospect) => ({
      id: prospect.id,
      business: prospect.business,
      stage: prospect.stage,
      href: attentionHref(prospect, role),
    }))

  const metricSource = role === 'sales_closer' || role === 'client_relations' ? prospects : everyone
  const metricRows = metricSource.map((prospect) => ({
    stage: prospect.stage,
    hasContact: Boolean(prospect.email || prospect.phone),
    handedToSales: Boolean(prospect.handedToSalesAt),
    estimatedValue: prospect.estimatedValue,
  }))
  let metrics = procurementMetrics(metricRows)
  if (role === 'sales_closer') metrics = salesMetrics(metricRows)
  if (role === 'admin') metrics = [...procurementMetrics(metricRows), ...salesMetrics(metricRows)]

  let onTime = 0
  let due = 0
  if (role === 'admin' || role === 'client_relations') {
    const won = everyone.filter((prospect) => roleCanSeeProspect('client_relations', prospect))
    const clientIds = won.map((prospect) => prospect.clientId).filter((id): id is string => Boolean(id))
    const tasks = await getTasksByClientIds(clientIds, {
      columns: 'id, client_id, status, due_date',
      limit: 500,
    })
    const today = new Date().toISOString().slice(0, 10)
    const dated = tasks.filter((task) => task.due_date)
    due = dated.length
    onTime = dated.filter((task) => task.status === 'completed' || String(task.due_date) >= today).length
    const relations = relationsMetrics({
      onTime,
      due,
      openOnboarding: won.filter((prospect) => !onboardingComplete(prospect.onboarding)).length,
    })
    metrics = role === 'client_relations' ? relations : [...metrics, ...relations]
  }

  const billable = role === 'sales_closer'
    ? prospects
        .filter((prospect) => prospect.stage === 'won')
        .slice(0, 20)
        .map((prospect) => ({
          id: prospect.id,
          business: prospect.business,
          paymentStatus: prospect.paymentStatus,
          servicesPurchased: prospect.servicesPurchased,
          clientId: prospect.clientId,
        }))
    : []

  const meetings = role === 'sales_closer' || role === 'admin'
    ? await listJoinableMeetings(prospects.map(meetingProspectRef), { includeUnmatchedCalendar: true })
    : []

  return {
    kind: 'marketing' as const,
    role: role || 'admin',
    followUps,
    handoffs,
    billable,
    meetings,
    metrics,
    workspaceConnected: isGoogleWorkspaceConfigured(),
  }
}

function meetingProspectRef(prospect: {
  id: string
  business: string
  stage?: string
  followUpAt?: string | null
  followUpEventId?: string | null
}): MeetingProspectRef {
  return {
    id: prospect.id,
    business: prospect.business,
    stage: prospect.stage,
    followUpAt: prospect.followUpAt,
    followUpEventId: prospect.followUpEventId,
  }
}

export async function loadProspectMeetingSources(
  prospects: MeetingProspectRef[],
  options?: { calendarEvents?: WorkspaceCalendarEvent[] }
): Promise<{
  stored: Awaited<ReturnType<typeof getAllMeetings>>
  bookings: Awaited<ReturnType<typeof listScheduledBookings>>
  calendarEvents: WorkspaceCalendarEvent[]
}> {
  const empty = { stored: [], bookings: [], calendarEvents: [] as WorkspaceCalendarEvent[] }
  if (prospects.length === 0 && !options?.calendarEvents) return empty
  try {
    const [stored, bookings] = await Promise.all([
      getAllMeetings().catch(() => []),
      listScheduledBookings().catch(() => []),
    ])
    const calendarEvents = options?.calendarEvents ?? await loadCalendarMeetings(prospects)
    return { stored, bookings, calendarEvents }
  } catch (error) {
    console.error('loadProspectMeetingSources error:', error)
    return empty
  }
}

export async function listJoinableMeetings(
  prospects: MeetingProspectRef[],
  options?: {
    includeUnmatchedCalendar?: boolean
    includeEnded?: boolean
    rangeStartMs?: number
    rangeEndMs?: number
    calendarEvents?: WorkspaceCalendarEvent[]
  }
): Promise<JoinableMeeting[]> {
  if (prospects.length === 0 && !options?.includeUnmatchedCalendar) return []
  try {
    const sources = await loadProspectMeetingSources(prospects, { calendarEvents: options?.calendarEvents })
    return assembleJoinableMeetings({
      prospects,
      meetings: sources.stored,
      bookings: sources.bookings,
      calendarEvents: sources.calendarEvents,
      includeUnmatchedCalendar: options?.includeUnmatchedCalendar,
      includeEnded: options?.includeEnded,
      rangeStartMs: options?.rangeStartMs,
      rangeEndMs: options?.rangeEndMs,
    })
  } catch (error) {
    console.error('listJoinableMeetings error:', error)
    return []
  }
}

export async function prospectFileSalesPayload(prospect: {
  id: string
  business: string
  email: string
  stage: string
  followUpAt: string | null
  followUpEventId?: string | null
  agreementSignedAt?: string | null
  proposalDocUrl?: string | null
}): Promise<{
  meetings: JoinableMeeting[]
  meetingHistory: JoinableMeeting[]
  meetingCardState: ReturnType<typeof prospectMeetingCardState>['state']
  agreement: ReturnType<typeof prospectAgreementCard>
}> {
  const ref = meetingProspectRef(prospect)
  const documents = prospect.email.trim()
    ? await getServiceDocumentsForClient(prospect.email).catch(() => [])
    : []
  const sources = await loadProspectMeetingSources([ref])
  const storedForProspect = sources.stored.filter((row) => row.lead_id === prospect.id)
  const meetings = assembleJoinableMeetings({
    prospects: [ref],
    meetings: sources.stored,
    bookings: sources.bookings,
    calendarEvents: sources.calendarEvents,
  })
  const meetingHistory = assembleJoinableMeetings({
    prospects: [ref],
    meetings: sources.stored,
    bookings: sources.bookings,
    calendarEvents: sources.calendarEvents,
    includeEnded: true,
  })
  return {
    meetings,
    meetingHistory,
    meetingCardState: prospectMeetingCardState({
      storedMeetings: storedForProspect,
      followUpAt: prospect.followUpAt,
      stage: prospect.stage,
    }).state,
    agreement: prospectAgreementCard({
      agreementSignedAt: prospect.agreementSignedAt,
      proposalDocUrl: prospect.proposalDocUrl,
      documents,
    }),
  }
}

async function loadCalendarMeetings(prospects: MeetingProspectRef[]): Promise<WorkspaceCalendarEvent[]> {
  if (!isGoogleWorkspaceConfigured()) return []
  try {
    const start = new Date(Date.now() - 60 * 60 * 1000)
    const end = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
    const listed = await listWorkspaceEvents({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 50,
    })
    const known = new Set(listed.map((event) => event.id))
    const missing = prospects
      .map((prospect) => prospect.followUpEventId || '')
      .filter((id) => id && !known.has(id))
      .slice(0, 10)
    const extras = (await Promise.all(missing.map((id) => getWorkspaceEvent(id)))).filter(
      (event): event is WorkspaceCalendarEvent => Boolean(event)
    )
    return [...listed, ...extras]
  } catch (error) {
    console.error('loadCalendarMeetings error:', error)
    return []
  }
}

export async function attachProspectMeetingLinks<T extends MeetingProspectRef>(
  prospects: T[],
  role?: string | null
): Promise<Array<T & { meetLink: string; calendarLink: string }>> {
  if (role !== 'sales_closer' && role !== 'admin') {
    return prospects.map((prospect) => ({ ...prospect, meetLink: '', calendarLink: '' }))
  }
  const meetings = await listJoinableMeetings(prospects.map(meetingProspectRef))
  const links = new Map<string, { meetLink: string; calendarLink: string }>()
  for (const meeting of meetings) {
    if (!meeting.prospectId) continue
    const current = links.get(meeting.prospectId) || { meetLink: '', calendarLink: '' }
    if (!current.meetLink && meeting.meetLink) current.meetLink = meeting.meetLink
    if (!current.calendarLink && meeting.calendarLink) current.calendarLink = meeting.calendarLink
    links.set(meeting.prospectId, current)
  }
  return prospects.map((prospect) => ({
    ...prospect,
    meetLink: links.get(prospect.id)?.meetLink || '',
    calendarLink: links.get(prospect.id)?.calendarLink || '',
  }))
}

export function roleMayUsePipeline(role?: string | null): boolean {
  return role === 'admin' || role === 'lead_procurement' || role === 'sales_closer' || role === 'client_relations'
}

/** Client relations can open the board. Stage edits stay with procurement, sales, and admin. */
export function roleMayEditPipeline(role?: string | null): boolean {
  return role === 'admin' || role === 'lead_procurement' || role === 'sales_closer'
}

export function assertPipelineRole(role?: string | null) {
  if (!roleMayUsePipeline(role)) throw new Error('Forbidden')
}

export type { MarketingRole }
