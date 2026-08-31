import { getSupabase } from './supabase'
import { emailIlikePattern } from './email-match'
import { decryptFieldOrLegacy } from './field-encryption'
import {
  getLeadById,
  getClientById,
  getLeads,
  getClients,
  getMessages,
  getFilesByClient,
  logActivity,
  type Lead,
  type Client,
  type ActivityLog,
} from './db'
import {
  deriveLeadTypeFromIntake,
  deriveIntakeClassification,
  mapApplicationStatusToCfClientStatus,
  type LeadType,
  type CreditFundingClientStatus,
  type MarketingLeadStatus,
  type MeetingType,
  type MeetingStatus,
} from './crm-types'
import {
  getCreditFundingApplications,
  getDocumentsByApplicationUuid,
  getCreditFundingMessages,
  getStatusHistory,
} from './credit-funding-db'
import type { CreditFundingApplication } from './credit-funding-types'

export interface ClientMeeting {
  id: string
  client_id?: string | null
  lead_id?: string | null
  application_uuid?: string | null
  title: string
  meeting_type: MeetingType
  scheduled_at: string
  duration_minutes: number
  notes: string
  assigned_staff?: string | null
  google_meet_link?: string | null
  status: MeetingStatus
  created_by: string
  created_at: string
}

export interface CrmContactRow {
  id: string
  entity_type: 'lead' | 'client'
  name: string
  email?: string
  phone?: string
  business: string
  lead_type: LeadType
  marketing_lead_status?: MarketingLeadStatus | null
  credit_funding_client_status?: CreditFundingClientStatus | null
  application_status?: string | null
  assigned_team_member?: string | null
  source?: string
  funding_amount?: string | null
  business_owner?: boolean | null
  created_at: string
  linked_client_id?: string | null
  linked_lead_id?: string | null
}

export interface ContactProfileSummary {
  entity_type: 'lead' | 'client'
  id: string
  name: string
  email?: string
  phone?: string
  business: string
  lead_type: LeadType
  current_status: string
  marketing_lead_status?: MarketingLeadStatus | null
  credit_funding_client_status?: CreditFundingClientStatus | null
  credit_repair_program?: string | null
  funding_program?: string | null
  assigned_team_member?: string | null
  next_meeting?: ClientMeeting | null
  funding_goal?: string | null
  estimated_funding_potential?: string | null
  source?: string
  notes?: string
  application?: CreditFundingApplication | null
}

export interface CrmDashboardStats {
  marketing_leads: number
  credit_repair_clients: number
  funding_clients: number
  business_funding_clients: number
  pending_applications: number
  active_clients: number
  completed_clients: number
}

export interface CrmReportMetrics extends CrmDashboardStats {
  total_marketing_leads: number
  credit_repair_apps: number
  funding_apps: number
  business_funding_apps: number
  consultations_scheduled: number
  consultations_completed: number
  conversion_rate: number
  funding_requests: number
  estimated_pipeline: string
}

export async function logCrmActivity(entry: {
  action: string
  entity_type: string
  entity_id?: string
  actor_email: string
  details?: string
}): Promise<void> {
  await logActivity(entry)
}

export async function getActivityForEntity(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<ActivityLog[]> {
  const { data, error } = await getSupabase()
    .from('activity_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('getActivityForEntity error:', error)
    return []
  }
  return data || []
}

export async function getActivityForContact(
  leadId?: string | null,
  clientId?: string | null,
  applicationUuid?: string | null,
  limit = 50
): Promise<ActivityLog[]> {
  const ids: { entity_type: string; entity_id: string }[] = []
  if (leadId) ids.push({ entity_type: 'lead', entity_id: leadId })
  if (clientId) ids.push({ entity_type: 'client', entity_id: clientId })
  if (applicationUuid) ids.push({ entity_type: 'credit_funding_application', entity_id: applicationUuid })

  if (!ids.length) return []

  const results = await Promise.all(
    ids.map(({ entity_type, entity_id }) => getActivityForEntity(entity_type, entity_id, limit))
  )
  return results
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}

function leadDisplayName(lead: Lead): string {
  return `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.business
}

function buildContactFromLead(lead: Lead, app?: CreditFundingApplication | null): CrmContactRow {
  return {
    id: lead.id,
    entity_type: 'lead',
    name: leadDisplayName(lead),
    email: lead.email,
    phone: lead.phone,
    business: lead.business,
    lead_type: (lead as Lead & { lead_type?: LeadType }).lead_type || 'marketing_lead',
    marketing_lead_status: (lead as Lead & { marketing_lead_status?: MarketingLeadStatus }).marketing_lead_status,
    credit_funding_client_status: (lead as Lead & { credit_funding_client_status?: CreditFundingClientStatus })
      .credit_funding_client_status,
    application_status: app?.status || null,
    assigned_team_member: (lead as Lead & { assigned_team_member?: string }).assigned_team_member,
    source: lead.source,
    funding_amount: app?.funding_amount || lead.budget || null,
    business_owner: app?.owns_business ?? null,
    created_at: lead.created_at,
    linked_client_id: (lead as Lead & { client_id?: string }).client_id || null,
    linked_lead_id: lead.id,
  }
}

function buildContactFromClient(client: Client, app?: CreditFundingApplication | null): CrmContactRow {
  return {
    id: client.id,
    entity_type: 'client',
    name: client.name,
    email: client.email,
    phone: client.phone,
    business: client.business,
    lead_type: (client as Client & { lead_type?: LeadType }).lead_type || 'existing_client',
    marketing_lead_status: (client as Client & { marketing_lead_status?: MarketingLeadStatus }).marketing_lead_status,
    credit_funding_client_status: (client as Client & { credit_funding_client_status?: CreditFundingClientStatus })
      .credit_funding_client_status,
    application_status: app?.status || null,
    assigned_team_member: (client as Client & { assigned_team_member?: string }).assigned_team_member,
    source: 'client',
    funding_amount: app?.funding_amount || null,
    business_owner: app?.owns_business ?? null,
    created_at: client.created_at,
    linked_client_id: client.id,
    linked_lead_id: (client as Client & { lead_id?: string }).lead_id || null,
  }
}

async function findApplicationForEmail(email?: string, clientId?: string): Promise<CreditFundingApplication | null> {
  if (!email && !clientId) return null
  const apps = await getCreditFundingApplications({ status: 'all' })
  const match = apps.find(
    (a) =>
      (clientId && a.client_id === clientId) ||
      (email && a.email.toLowerCase() === email.toLowerCase())
  )
  return match || null
}

export async function getCrmContacts(filters?: {
  lead_type?: string
  application_status?: string
  assigned_team_member?: string
  date_from?: string
  date_to?: string
  funding_amount_min?: number
  business_owner?: boolean
  credit_repair?: boolean
  search?: string
}): Promise<CrmContactRow[]> {
  const [leads, clients, applications] = await Promise.all([
    getLeads(),
    getClients(),
    getCreditFundingApplications({ status: 'all' }),
  ])

  const appByEmail = new Map(applications.map((a) => [a.email.toLowerCase(), a]))
  const appByClientId = new Map(
    applications.filter((a) => a.client_id).map((a) => [a.client_id as string, a])
  )

  const rows: CrmContactRow[] = []

  for (const lead of leads) {
    const linkedClientId = (lead as Lead & { client_id?: string }).client_id
    if (linkedClientId && clients.some((c) => c.id === linkedClientId)) continue
    const app = lead.email ? appByEmail.get(lead.email.toLowerCase()) : undefined
    rows.push(buildContactFromLead(lead, app))
  }

  for (const client of clients) {
    const app = appByClientId.get(client.id) || (client.email ? appByEmail.get(client.email.toLowerCase()) : undefined)
    rows.push(buildContactFromClient(client, app))
  }

  let filtered = rows

  if (filters?.lead_type && filters.lead_type !== 'all') {
    filtered = filtered.filter((r) => r.lead_type === filters.lead_type)
  }
  if (filters?.application_status && filters.application_status !== 'all') {
    filtered = filtered.filter((r) => r.application_status === filters.application_status)
  }
  if (filters?.assigned_team_member && filters.assigned_team_member !== 'all') {
    filtered = filtered.filter((r) => r.assigned_team_member === filters.assigned_team_member)
  }
  if (filters?.date_from) {
    const from = new Date(filters.date_from).getTime()
    filtered = filtered.filter((r) => new Date(r.created_at).getTime() >= from)
  }
  if (filters?.date_to) {
    const to = new Date(filters.date_to).getTime()
    filtered = filtered.filter((r) => new Date(r.created_at).getTime() <= to)
  }
  if (filters?.funding_amount_min != null) {
    filtered = filtered.filter((r) => {
      const amt = parseFloat(String(r.funding_amount || '0').replace(/[^0-9.]/g, ''))
      return amt >= filters.funding_amount_min!
    })
  }
  if (filters?.business_owner === true) {
    filtered = filtered.filter((r) => r.business_owner === true)
  }
  if (filters?.credit_repair === true) {
    filtered = filtered.filter((r) =>
      ['credit_repair_lead', 'credit_repair_funding'].includes(r.lead_type)
    )
  }
  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.business.toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
    )
  }

  return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function getCrmDashboardStats(): Promise<CrmDashboardStats> {
  const [leads, clients, applications] = await Promise.all([
    getLeads(),
    getClients(),
    getCreditFundingApplications({ status: 'all' }),
  ])

  const leadTypes = (item: { lead_type?: LeadType }) => item.lead_type || 'marketing_lead'

  return {
    marketing_leads: leads.filter((l) => leadTypes(l as Lead & { lead_type?: LeadType }) === 'marketing_lead').length,
    credit_repair_clients: [...leads, ...clients].filter((x) =>
      ['credit_repair_lead', 'credit_repair_funding'].includes(leadTypes(x as { lead_type?: LeadType }))
    ).length,
    funding_clients: [...leads, ...clients].filter((x) =>
      ['personal_funding_lead', 'business_funding_lead', 'credit_repair_funding'].includes(
        leadTypes(x as { lead_type?: LeadType })
      )
    ).length,
    business_funding_clients: [...leads, ...clients].filter(
      (x) => leadTypes(x as { lead_type?: LeadType }) === 'business_funding_lead'
    ).length,
    pending_applications: applications.filter((a) =>
      ['submitted', 'documents_pending', 'under_review', 'additional_information_requested'].includes(a.status)
    ).length,
    active_clients: clients.filter((c) => c.status === 'active').length,
    completed_clients: [...clients, ...leads].filter(
      (x) => leadTypes(x as { lead_type?: LeadType }) === 'completed_client'
    ).length,
  }
}

export async function getCrmReportMetrics(): Promise<CrmReportMetrics> {
  const stats = await getCrmDashboardStats()
  const applications = await getCreditFundingApplications({ status: 'all' })
  const leads = await getLeads()
  const meetings = await getAllMeetings()

  const marketingConverted = leads.filter(
    (l) => (l as Lead & { marketing_lead_status?: string }).marketing_lead_status === 'converted'
  ).length
  const marketingTotal = leads.filter(
    (l) => ((l as Lead & { lead_type?: LeadType }).lead_type || 'marketing_lead') === 'marketing_lead'
  ).length

  const pipelineAmounts = applications
    .map((a) => parseFloat(String(a.funding_amount || '0').replace(/[^0-9.]/g, '')))
    .filter((n) => n > 0)

  const pipelineSum = pipelineAmounts.reduce((s, n) => s + n, 0)

  return {
    ...stats,
    total_marketing_leads: stats.marketing_leads,
    credit_repair_apps: applications.filter(
      (a) =>
        (a.lead_type as LeadType | undefined) === 'credit_repair_lead' ||
        (a.lead_type as LeadType | undefined) === 'credit_repair_funding' ||
        a.service_type === 'credit_repair'
    ).length,
    funding_apps: applications.filter(
      (a) =>
        a.service_type === 'business_funding' ||
        a.service_type === 'credit_and_funding' ||
        a.service_type === 'personal_funding' ||
        (a.lead_type as LeadType | undefined) === 'personal_funding_lead' ||
        (a.lead_type as LeadType | undefined) === 'business_funding_lead' ||
        (a.lead_type as LeadType | undefined) === 'credit_repair_funding'
    ).length,
    business_funding_apps: applications.filter((a) => a.service_type === 'business_funding').length,
    consultations_scheduled: meetings.filter((m) => m.meeting_type === 'consultation' && m.status === 'scheduled')
      .length,
    consultations_completed: meetings.filter((m) => m.meeting_type === 'consultation' && m.status === 'completed')
      .length,
    conversion_rate: marketingTotal > 0 ? Math.round((marketingConverted / marketingTotal) * 100) : 0,
    funding_requests: applications.length,
    estimated_pipeline: pipelineSum > 0 ? `$${pipelineSum.toLocaleString()}` : '$0',
  }
}

export async function getContactProfile(
  entityType: 'lead' | 'client',
  id: string
): Promise<{
  profile: ContactProfileSummary
  meetings: ClientMeeting[]
  activity: ActivityLog[]
  messages: Awaited<ReturnType<typeof getMessages>>
  files: Awaited<ReturnType<typeof getFilesByClient>>
  applicationDocs: Awaited<ReturnType<typeof getDocumentsByApplicationUuid>>
  commHistory: Awaited<ReturnType<typeof getCreditFundingMessages>>
  statusHistory: Awaited<ReturnType<typeof getStatusHistory>>
} | null> {
  if (entityType === 'lead') {
    const lead = await getLeadById(id)
    if (!lead) return null
    const app = await findApplicationForEmail(lead.email, (lead as Lead & { client_id?: string }).client_id)
    const meetings = await getMeetingsForContact({ leadId: id })
    const nextMeeting =
      meetings.filter((m) => m.status === 'scheduled' && new Date(m.scheduled_at) >= new Date())[0] || null

    const fundingScores = app?.funding_scores as { estimated_range?: string } | undefined

    const profile: ContactProfileSummary = {
      entity_type: 'lead',
      id: lead.id,
      name: leadDisplayName(lead),
      email: lead.email,
      phone: lead.phone,
      business: lead.business,
      lead_type: (lead as Lead & { lead_type?: LeadType }).lead_type || 'marketing_lead',
      current_status:
        (lead as Lead & { credit_funding_client_status?: string }).credit_funding_client_status ||
        (lead as Lead & { marketing_lead_status?: string }).marketing_lead_status ||
        lead.status,
      marketing_lead_status: (lead as Lead & { marketing_lead_status?: MarketingLeadStatus }).marketing_lead_status,
      credit_funding_client_status: (lead as Lead & { credit_funding_client_status?: CreditFundingClientStatus })
        .credit_funding_client_status,
      credit_repair_program: app?.service_type === 'credit_repair' ? 'Credit Repair' : app?.credit_goals?.join(', '),
      funding_program: app?.service_type || null,
      assigned_team_member:
        (lead as Lead & { assigned_team_member?: string }).assigned_team_member || app?.assigned_specialist,
      next_meeting: nextMeeting,
      funding_goal: app?.funding_amount || app?.funding_goals || lead.budget,
      estimated_funding_potential: fundingScores?.estimated_range || null,
      source: lead.source,
      notes: lead.notes,
      application: app,
    }

    const activity = await getActivityForContact(id, (lead as Lead & { client_id?: string }).client_id, app?.id)

    return {
      profile,
      meetings,
      activity,
      messages: [],
      files: [],
      applicationDocs: app ? await getDocumentsByApplicationUuid(app.id) : [],
      commHistory: app ? await getCreditFundingMessages(app.id) : [],
      statusHistory: app ? await getStatusHistory(app.id) : [],
    }
  }

  const client = await getClientById(id)
  if (!client) return null
  const app = await findApplicationForEmail(client.email, client.id)
  const meetings = await getMeetingsForContact({ clientId: id })
  const nextMeeting =
    meetings.filter((m) => m.status === 'scheduled' && new Date(m.scheduled_at) >= new Date())[0] || null
  const fundingScores = app?.funding_scores as { estimated_range?: string } | undefined

  const profile: ContactProfileSummary = {
    entity_type: 'client',
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    business: client.business,
    lead_type: (client as Client & { lead_type?: LeadType }).lead_type || 'existing_client',
    current_status:
      (client as Client & { credit_funding_client_status?: string }).credit_funding_client_status || client.status,
    marketing_lead_status: (client as Client & { marketing_lead_status?: MarketingLeadStatus }).marketing_lead_status,
    credit_funding_client_status: (client as Client & { credit_funding_client_status?: CreditFundingClientStatus })
      .credit_funding_client_status,
    credit_repair_program: app?.service_type === 'credit_repair' ? 'Credit Repair' : app?.credit_goals?.join(', '),
    funding_program: app?.service_type || null,
    assigned_team_member:
      (client as Client & { assigned_team_member?: string }).assigned_team_member || app?.assigned_specialist,
    next_meeting: nextMeeting,
    funding_goal: app?.funding_amount || app?.funding_goals,
    estimated_funding_potential: fundingScores?.estimated_range || null,
    source: 'client',
    notes: client.notes,
    application: app,
  }

  const activity = await getActivityForContact(
    (client as Client & { lead_id?: string }).lead_id,
    client.id,
    app?.id
  )

  return {
    profile,
    meetings,
    activity,
    messages: await getMessages(client.id),
    files: await getFilesByClient(client.id),
    applicationDocs: app ? await getDocumentsByApplicationUuid(app.id) : [],
    commHistory: app ? await getCreditFundingMessages(app.id) : [],
    statusHistory: app ? await getStatusHistory(app.id) : [],
  }
}

export async function upsertLeadFromCreditIntake(params: {
  email: string
  fullName: string
  phone: string
  businessName?: string
  creditGoals: string[]
  fundingUse: string
  applicationUuid: string
  clientId?: string
}): Promise<Lead | null> {
  const leadType = deriveLeadTypeFromIntake(params.creditGoals, params.fundingUse)
  const cfStatus: CreditFundingClientStatus = 'intake_completed'
  const nameParts = params.fullName.trim().split(/\s+/)
  const firstName = nameParts[0] || 'Applicant'
  const lastName = nameParts.slice(1).join(' ')

  const { data: existingRows } = await getSupabase()
    .from('leads')
    .select('*')
    .ilike('email', emailIlikePattern(params.email))
    .limit(1)

  const existing = existingRows?.[0] as Lead | undefined

  if (existing) {
    const { data, error } = await getSupabase()
      .from('leads')
      .update({
        lead_type: leadType,
        credit_funding_client_status: cfStatus,
        phone: params.phone || existing.phone,
        business: params.businessName || existing.business,
        client_id: params.clientId || (existing as Lead & { client_id?: string }).client_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) {
      console.error('upsertLeadFromCreditIntake update error:', error)
      return null
    }
    await getSupabase()
      .from('credit_funding_applications')
      .update({ lead_id: existing.id, lead_type: leadType, credit_funding_client_status: cfStatus })
      .eq('id', params.applicationUuid)
    return data as Lead
  }

  const { data, error } = await getSupabase()
    .from('leads')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: params.email,
      phone: params.phone,
      business: params.businessName || `${firstName} ${lastName}`,
      source: 'inbound',
      lead_type: leadType,
      credit_funding_client_status: cfStatus,
      marketing_lead_status: null,
      client_id: params.clientId || null,
    })
    .select()
    .single()

  if (error) {
    console.error('upsertLeadFromCreditIntake insert error:', error)
    return null
  }

  await getSupabase()
    .from('credit_funding_applications')
    .update({ lead_id: data.id, lead_type: leadType, credit_funding_client_status: cfStatus })
    .eq('id', params.applicationUuid)

  return data as Lead
}

export async function syncClientFromLead(leadId: string, clientId: string): Promise<void> {
  const lead = await getLeadById(leadId)
  if (!lead) return

  await getSupabase()
    .from('leads')
    .update({
      lead_type: 'existing_client',
      marketing_lead_status: 'converted',
      client_id: clientId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  await getSupabase()
    .from('clients')
    .update({
      lead_id: leadId,
      lead_type: (lead as Lead & { lead_type?: LeadType }).lead_type || 'existing_client',
      assigned_team_member: (lead as Lead & { assigned_team_member?: string }).assigned_team_member,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
}

export async function ensureClientFromCreditApplication(app: CreditFundingApplication): Promise<Client | null> {
  if (app.client_id) {
    const existing = await getClientById(app.client_id)
    if (existing) {
      await getSupabase()
        .from('clients')
        .update({
          lead_type: (app.lead_type as LeadType) || deriveLeadTypeFromIntake(app.credit_goals, app.funding_use || ''),
          credit_funding_client_status: mapApplicationStatusToCfClientStatus(app.status),
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.client_id)
      return existing
    }
  }

  const { data: existingClients } = await getSupabase()
    .from('clients')
    .select('*')
    .ilike('email', emailIlikePattern(app.email))
    .limit(1)

  if (existingClients?.[0]) {
    const client = existingClients[0] as Client
    await getSupabase()
      .from('credit_funding_applications')
      .update({ client_id: client.id })
      .eq('id', app.id)
    await getSupabase()
      .from('clients')
      .update({
        lead_type: (app.lead_type as LeadType) || 'credit_repair_funding',
        credit_funding_client_status: mapApplicationStatusToCfClientStatus(app.status),
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)
    return client
  }

  const { data, error } = await getSupabase()
    .from('clients')
    .insert({
      name: app.full_name,
      business: app.business_name || app.full_name,
      email: app.email,
      phone: decryptFieldOrLegacy(app.phone),
      package_tier: 'free',
      monthly_price: 0,
      start_date: new Date().toISOString(),
      status: 'active',
      is_potential: true,
      billing_status: 'not_started',
      notes: `Auto-created from Credit & Funding application ${app.application_id}`,
      deliverables: [],
      quick_wins: [],
      lead_type: (app.lead_type as LeadType) || deriveLeadTypeFromIntake(app.credit_goals, app.funding_use || ''),
      credit_funding_client_status: mapApplicationStatusToCfClientStatus(app.status),
    })
    .select()
    .single()

  if (error) {
    console.error('ensureClientFromCreditApplication error:', error)
    return null
  }

  await getSupabase()
    .from('credit_funding_applications')
    .update({ client_id: data.id })
    .eq('id', app.id)

  return data as Client
}

// ─── Meetings ───

export async function getAllMeetings(): Promise<ClientMeeting[]> {
  const { data, error } = await getSupabase()
    .from('client_meetings')
    .select('*')
    .order('scheduled_at', { ascending: false })
  if (error) {
    if (error.code !== '42P01') console.error('getAllMeetings error:', error)
    return []
  }
  return (data || []) as ClientMeeting[]
}

export async function getMeetingsForContact(opts: {
  clientId?: string
  leadId?: string
}): Promise<ClientMeeting[]> {
  let query = getSupabase().from('client_meetings').select('*').order('scheduled_at', { ascending: false })
  if (opts.clientId) query = query.eq('client_id', opts.clientId)
  else if (opts.leadId) query = query.eq('lead_id', opts.leadId)
  else return []

  const { data, error } = await query
  if (error) {
    if (error.code !== '42P01') console.error('getMeetingsForContact error:', error)
    return []
  }
  return (data || []) as ClientMeeting[]
}

export async function getMeetingsByClientId(clientId: string): Promise<ClientMeeting[]> {
  return getMeetingsForContact({ clientId })
}

export async function getMeetingById(id: string): Promise<ClientMeeting | null> {
  const { data, error } = await getSupabase().from('client_meetings').select('*').eq('id', id).single()
  if (error) return null
  return data as ClientMeeting
}

export async function createMeeting(
  meeting: Omit<ClientMeeting, 'id' | 'created_at'>
): Promise<ClientMeeting | null> {
  const { data, error } = await getSupabase().from('client_meetings').insert(meeting).select().single()
  if (error) {
    console.error('createMeeting error:', error)
    return null
  }
  return data as ClientMeeting
}

export async function updateMeeting(
  id: string,
  updates: Partial<Omit<ClientMeeting, 'id' | 'created_at' | 'created_by'>>
): Promise<ClientMeeting | null> {
  const { data, error } = await getSupabase().from('client_meetings').update(updates).eq('id', id).select().single()
  if (error) {
    console.error('updateMeeting error:', error)
    return null
  }
  return data as ClientMeeting
}

export { deriveLeadTypeFromIntake, mapApplicationStatusToCfClientStatus, deriveIntakeClassification }
