import { getCreditFundingApplicationByEmail } from '@/lib/credit-funding-db'
import { getTasksByClient, logActivity, updateClient } from '@/lib/db'
import {
  createProposalDocument,
  ensureDriveFolder,
  isGoogleWorkspaceConfigured,
  listWorkspaceEvents,
  proposalDocumentText,
  readWorkspaceThread,
  sendWorkspaceEmail,
  uploadDriveFile,
  upsertFollowUpEvent,
  upsertWorkspaceContact,
} from '@/lib/google-workspace'
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
  salesHandoffGaps,
  salesMetrics,
  scoreTotal,
  stageFromLegacy,
  stageAfterOutboundEmail,
  stageAfterProspectReply,
  stagesVisibleToRole,
} from '@/lib/marketing-pipeline'
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
  if (role === 'admin') return true
  const allowed = stagesVisibleToRole(role)
  if (allowed === 'all') return true
  return allowed.includes(prospect.stage)
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
  const contact = splitContact(clean(input.contactName) || existing?.contactName || business)
  const categoryInput = clean(input.category) || existing?.category || ''
  if (categoryInput && !isProspectCategory(categoryInput)) throw new Error('Prospect category must be established, small, or startup')

  const estimated =
    input.estimatedValue === undefined || input.estimatedValue === null || input.estimatedValue === ''
      ? existing?.estimatedValue ?? null
      : Number(input.estimatedValue)

  const payload: Record<string, unknown> = {
    first_name: contact.first || business,
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
    updated_at: new Date().toISOString(),
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
  if (prospect.followUpAt) {
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
      throw new Error('Move the prospect to Won before handing it to client relations')
    }
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
    })
    if (gaps.length) throw new Error(`Still needed: ${gaps.join(', ')}`)
  }

  let driveFolderId = prospect.driveFolderId
  let driveFolderUrl = prospect.driveFolderUrl
  if (target === 'client_relations' && isGoogleWorkspaceConfigured()) {
    const folder = await ensureDriveFolder({ name: prospect.business, existingId: prospect.driveFolderId })
    driveFolderId = folder.id
    driveFolderUrl = folder.url
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    assigned_role: target,
    drive_folder_id: driveFolderId,
    drive_folder_url: driveFolderUrl,
    updated_at: now,
    ...(target === 'sales_closer' ? { handed_to_sales_at: now } : { handed_to_relations_at: now }),
  }
  const { error } = await getSupabase().from('leads').update(updates).eq('id', id)
  if (error) throw new Error('Could not save the handoff')
  await getSupabase().from('marketing_handoffs').insert({
    lead_id: id,
    from_role: actor.role || 'admin',
    to_role: target,
    checklist: target === 'sales_closer'
      ? { business: prospect.business, opportunity: prospect.opportunity, score: prospect.score, source: prospect.source }
      : { services: prospect.servicesPurchased, payment: prospect.paymentStatus, proposal: prospect.proposalDocUrl },
    notes: prospect.notes,
    created_by: actor.email || '',
  })
  if (prospect.clientId && driveFolderId) {
    await updateClient(prospect.clientId, {
      drive_folder_id: driveFolderId,
      drive_folder_url: driveFolderUrl,
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
  const { error } = await getSupabase()
    .from('leads')
    .update({
      gmail_thread_id: sent.threadId,
      last_contacted_at: now,
      pipeline_stage: stage,
      marketing_lead_status: marketingStatusForStage(stage),
      status: legacyLeadStatusForStage(stage),
      updated_at: now,
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

export async function loadMarketingToday(role?: string | null) {
  const allProspects = await listMarketingProspects(role === 'client_relations' ? 'admin' : role)
  const prospects = role === 'client_relations' ? allProspects.filter((prospect) => prospect.stage === 'won') : allProspects
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
      if (role === 'sales_closer') return Boolean(prospect.handedToSalesAt) && (prospect.stage === 'ready_to_contact' || prospect.stage === 'contacted')
      if (role === 'client_relations') return prospect.stage === 'won' && !onboardingComplete(prospect.onboarding)
      if (role === 'lead_procurement') return prospect.stage === 'researching' || prospect.stage === 'ready_to_contact'
      return (
        (Boolean(prospect.handedToSalesAt) && (prospect.stage === 'ready_to_contact' || prospect.stage === 'contacted'))
        || (prospect.stage === 'won' && !onboardingComplete(prospect.onboarding))
      )
    })
    .slice(0, 12)
    .map((prospect) => ({
      id: prospect.id,
      business: prospect.business,
      stage: prospect.stage,
      href: prospect.stage === 'won' ? '/admin/clients' : `/admin/pipeline/${prospect.id}`,
    }))

  const metricRows = prospects.map((prospect) => ({
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
    const won = prospects.filter((prospect) => prospect.stage === 'won')
    const clientIds = won.map((prospect) => prospect.clientId).filter((id): id is string => Boolean(id))
    const tasks = (await Promise.all(clientIds.map((clientId) => getTasksByClient(clientId).catch(() => [])))).flat()
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

  let calendarEvents: Array<{ id: string; summary: string; start: string; htmlLink: string }> = []
  if (isGoogleWorkspaceConfigured()) {
    try {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      calendarEvents = await listWorkspaceEvents({ timeMin: start.toISOString(), timeMax: end.toISOString() })
    } catch (error) {
      console.error('today calendar error:', error)
    }
  }

  return {
    kind: 'marketing' as const,
    role: role || 'admin',
    followUps,
    handoffs,
    calendarEvents,
    metrics,
    workspaceConnected: isGoogleWorkspaceConfigured(),
  }
}

export function roleMayUsePipeline(role?: string | null): boolean {
  return role === 'admin' || role === 'lead_procurement' || role === 'sales_closer'
}

export function assertPipelineRole(role?: string | null) {
  if (!roleMayUsePipeline(role)) throw new Error('Forbidden')
}

export type { MarketingRole }
