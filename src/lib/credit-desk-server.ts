import { expertDisplayName, filterCreditApplicationsForViewer, listCreditExpertOptions, type CreditStaffViewer } from '@/lib/credit-expert-assignment'
import { formatApplicationListItemForAdmin } from '@/lib/credit-funding-admin'
import { getCreditFundingApplications } from '@/lib/credit-funding-db'
import {
  addItemStatus,
  buildCreditQueue,
  creditInsights,
  creditPulse,
  emptyItemCounts,
  roundsTracker,
  type DeskClient,
  type DeskItemCounts,
  type DeskRound,
  type DeskRoundStatus,
} from '@/lib/credit-desk'
import { getSupabase } from '@/lib/supabase'

type Row = Record<string, unknown>

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** Rows for a column in chunks, so a long id list never overflows the URL. */
async function selectIn(table: string, columns: string, column: string, ids: string[], extra?: (query: any) => any): Promise<Row[]> {
  const out: Row[] = []
  for (let index = 0; index < ids.length; index += 150) {
    let query = getSupabase().from(table).select(columns).in(column, ids.slice(index, index + 150))
    if (extra) query = extra(query)
    const { data, error } = await query
    if (error) {
      console.error(`credit desk ${table} load error:`, error.message)
      continue
    }
    out.push(...((data || []) as unknown as Row[]))
  }
  return out
}

/**
 * Everything on the Credit desk, scoped to what the viewer may open.
 * Reads operational columns only: no message text, report data, or identity fields.
 */
export async function loadCreditDesk(viewer: CreditStaffViewer) {
  const now = new Date()
  const applications = filterCreditApplicationsForViewer(await getCreditFundingApplications({ status: 'all', search: '' }), viewer)
    .filter((app) => app.status !== 'draft' || viewer.role === 'admin')
  const ids = applications.map((app) => app.id)
  const clientIds = [...new Set(applications.map((app) => app.client_id).filter((id): id is string => Boolean(id)))]

  const [experts, cases, messages, requests, clients] = await Promise.all([
    listCreditExpertOptions().catch(() => []),
    selectIn('dispute_cases', 'id, application_uuid', 'application_uuid', ids),
    selectIn('credit_funding_messages', 'application_uuid, from_role, created_at', 'application_uuid', ids),
    selectIn('credit_funding_document_requests', 'application_uuid, created_at', 'application_uuid', ids, (q) => q.eq('status', 'pending')),
    selectIn('clients', 'id, billing_model, repair_fee_cents, repair_fee_paid_at', 'id', clientIds),
  ])
  const caseToApp = new Map(cases.map((row) => [String(row.id), String(row.application_uuid)]))
  const caseIds = [...caseToApp.keys()]
  const [rounds, items] = await Promise.all([
    selectIn('dispute_rounds', 'id, case_id, round_number, status, session_id, started_at, mailed_at, delivered_at, deadline_at', 'case_id', caseIds),
    selectIn('dispute_items', 'case_id, current_status', 'case_id', caseIds),
  ])

  const roundsByApp = new Map<string, DeskRound[]>()
  for (const row of rounds) {
    const app = caseToApp.get(String(row.case_id))
    if (!app) continue
    const list = roundsByApp.get(app) || []
    list.push({
      id: String(row.id),
      applicationUuid: app,
      roundNumber: Number(row.round_number) || 1,
      status: String(row.status) as DeskRoundStatus,
      sessionId: text(row.session_id),
      startedAt: text(row.started_at),
      mailedAt: text(row.mailed_at),
      deliveredAt: text(row.delivered_at),
      deadlineAt: text(row.deadline_at),
    })
    roundsByApp.set(app, list)
  }
  const itemsByApp = new Map<string, DeskItemCounts>()
  for (const row of items) {
    const app = caseToApp.get(String(row.case_id))
    if (!app) continue
    itemsByApp.set(app, addItemStatus(itemsByApp.get(app) || emptyItemCounts(), String(row.current_status)))
  }
  const lastMessage = new Map<string, { applicant: string | null; staff: string | null }>()
  for (const row of messages) {
    const app = String(row.application_uuid)
    const at = String(row.created_at)
    const entry = lastMessage.get(app) || { applicant: null, staff: null }
    if (row.from_role === 'applicant') entry.applicant = !entry.applicant || entry.applicant < at ? at : entry.applicant
    else entry.staff = !entry.staff || entry.staff < at ? at : entry.staff
    lastMessage.set(app, entry)
  }
  const pending = new Map<string, { count: number; oldest: string }>()
  for (const row of requests) {
    const app = String(row.application_uuid)
    const at = String(row.created_at)
    const entry = pending.get(app) || { count: 0, oldest: at }
    entry.count += 1
    if (at < entry.oldest) entry.oldest = at
    pending.set(app, entry)
  }
  const billing = new Map(clients.map((row) => [String(row.id), row]))

  const desk: DeskClient[] = applications.map((app) => {
    const listed = formatApplicationListItemForAdmin(app)
    const bill = app.client_id ? billing.get(app.client_id) : undefined
    const messagesFor = lastMessage.get(app.id)
    const requestsFor = pending.get(app.id)
    return {
      id: app.id,
      applicationId: listed.application_id,
      name: listed.full_name,
      email: listed.email,
      phone: listed.phone,
      status: listed.status,
      serviceType: listed.service_type || '',
      assignedSpecialist: listed.assigned_specialist || null,
      expertName: expertDisplayName(experts, app.assigned_specialist) || '',
      clientId: app.client_id || null,
      createdAt: listed.created_at,
      updatedAt: listed.updated_at,
      lastApplicantMessageAt: messagesFor?.applicant || null,
      lastStaffMessageAt: messagesFor?.staff || null,
      pendingRequests: requestsFor?.count || 0,
      oldestPendingRequestAt: requestsFor?.oldest || null,
      feeCents: bill && bill.repair_fee_cents != null ? Number(bill.repair_fee_cents) : null,
      feePaidAt: bill ? text(bill.repair_fee_paid_at) : null,
      billingModel: bill ? text(bill.billing_model) : null,
      rounds: (roundsByApp.get(app.id) || []).sort((a, b) => a.roundNumber - b.roundNumber),
      items: itemsByApp.get(app.id) || emptyItemCounts(),
    }
  })

  const role = viewer.role || 'admin'
  return {
    role,
    experts: role === 'admin' ? experts : [],
    clients: desk,
    queue: buildCreditQueue(desk, role, now),
    pulse: creditPulse(desk, now),
    rounds: roundsTracker(desk, now),
    insights: creditInsights(desk),
  }
}
