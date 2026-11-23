import { getClients, getTasksByClientIds, logActivity } from '@/lib/db'
import { isGoogleWorkspaceConfigured } from '@/lib/google-workspace'
import {
  getMarketingProspect,
  listJoinableMeetings,
  listMarketingProspects,
  prospectVisibleToRole,
  roleMayEditPipeline,
  saveMarketingProspect,
  type MarketingActor,
  type MarketingProspect,
} from '@/lib/marketing-crm'
import { marketingKpiCounts, stripeHasConfirmedPayment } from '@/lib/marketing-pipeline'
import {
  CALL_OUTCOMES,
  buildWorkQueue,
  callAction,
  callOutcome,
  clientAccounts,
  followUpForOutcome,
  isCallOutcome,
  prospectTimeline,
  stageAfterCall,
  workspaceInsights,
  workspacePulse,
  type CallOutcome,
  type WorkspaceActivity,
} from '@/lib/marketing-workspace'
import { isMarketingClient } from '@/lib/people'
import { getSupabase } from '@/lib/supabase'

const WORK_ACTIONS = [...CALL_OUTCOMES.map((outcome) => callAction(outcome.key)), 'note']

type ActivityRow = {
  id: string
  entity_id: string | null
  action: string
  details: string | null
  actor_email: string | null
  created_at: string
}

function toActivity(row: ActivityRow): WorkspaceActivity {
  return {
    id: row.id,
    leadId: row.entity_id || '',
    action: row.action,
    details: row.details || '',
    actor: row.actor_email || '',
    createdAt: row.created_at,
  }
}

/** Calls and notes logged on leads in the last `days` days. */
async function recentWorkActivity(days: number): Promise<WorkspaceActivity[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await getSupabase()
    .from('activity_log')
    .select('id, entity_id, action, details, actor_email, created_at')
    .eq('entity_type', 'lead')
    .in('action', WORK_ACTIONS)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) {
    console.error('marketing activity load error:', error.message)
    return []
  }
  return ((data || []) as ActivityRow[]).map(toActivity)
}

async function leadActivity(id: string): Promise<WorkspaceActivity[]> {
  const { data, error } = await getSupabase()
    .from('activity_log')
    .select('id, entity_id, action, details, actor_email, created_at')
    .eq('entity_type', 'lead')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.error('lead activity load error:', error.message)
    return []
  }
  return ((data || []) as ActivityRow[]).map(toActivity)
}

/** Everything the marketing workspace shows, scoped to what the role may see. */
export async function loadMarketingWorkspace(role?: string | null) {
  const viewer = role || 'admin'
  const now = new Date()
  const [prospects, activities, clients] = await Promise.all([
    listMarketingProspects(viewer),
    recentWorkActivity(30),
    getClients().catch(() => []),
  ])
  const visibleIds = new Set(prospects.map((prospect) => prospect.id))
  const ownActivity = activities.filter((row) => visibleIds.has(row.leadId))

  const queue = buildWorkQueue(prospects, ownActivity, viewer, now)
  const pulse = workspacePulse(prospects, ownActivity, queue, now)
  const insights = workspaceInsights(prospects, ownActivity, now)

  const marketingClients = clients.filter((client) => isMarketingClient(client))
  const recordedRevenue = marketingClients
    .filter((client) => stripeHasConfirmedPayment(client))
    .reduce((sum, client) => sum + (Number(client.monthly_price) || 0), 0)
  const kpis = marketingKpiCounts(prospects, recordedRevenue)

  const won = prospects.filter((prospect) => prospect.stage === 'won')
  const tasks = await getTasksByClientIds(
    won.map((prospect) => prospect.clientId).filter((id): id is string => Boolean(id)),
    { columns: 'id, client_id, title, status, due_date', limit: 1000 }
  )
  const accounts = clientAccounts(
    won,
    tasks.map((task) => ({ clientId: task.client_id, status: task.status, dueDate: task.due_date || null, title: task.title })),
    clients,
    now
  )

  const meetings = viewer === 'admin' || viewer === 'sales_closer'
    ? await listJoinableMeetings(prospects, { includeUnmatchedCalendar: true })
    : []

  return {
    role: viewer,
    canEdit: roleMayEditPipeline(viewer),
    pulse,
    queue,
    accounts,
    insights,
    kpis,
    meetings,
    workspaceConnected: isGoogleWorkspaceConfigured(),
  }
}

export async function loadProspectTimeline(prospect: MarketingProspect) {
  return prospectTimeline(prospect, await leadActivity(prospect.id))
}

export type ActivityInput = {
  type?: unknown
  outcome?: unknown
  note?: unknown
  followUpAt?: unknown
}

function followUpInput(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error('Follow-up must be a valid date')
  return date.toISOString()
}

/**
 * Log a call or a note on a lead. A call can move the stage (per the role's
 * rules) and sets the next follow-up; an explicit followUpAt overrides that.
 */
export async function logProspectActivity(id: string, input: ActivityInput, actor: MarketingActor) {
  if (!roleMayEditPipeline(actor.role)) throw new Error('You cannot log activity on this prospect')
  const prospect = await getMarketingProspect(id)
  if (!prospect || !prospectVisibleToRole(prospect, actor.role)) throw new Error('Prospect not found')

  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 2000) : ''
  const now = new Date()
  let warning: string | undefined
  let saved = prospect

  if (input.type === 'note') {
    if (!note) throw new Error('Write a note first')
    const explicit = followUpInput(input.followUpAt)
    await logActivity({ action: 'note', entity_type: 'lead', entity_id: id, actor_email: actor.email || 'staff', details: note })
    if (explicit !== undefined && explicit !== prospect.followUpAt) {
      const result = await saveMarketingProspect(id, { followUpAt: explicit }, actor)
      saved = result.prospect
      warning = result.warning
    }
  } else if (input.type === 'call') {
    if (!isCallOutcome(input.outcome)) throw new Error('Choose how the call went')
    const outcome = input.outcome as CallOutcome
    const stage = stageAfterCall(actor.role, prospect.stage, outcome)
    const explicit = followUpInput(input.followUpAt)
    const followUpAt = explicit !== undefined ? explicit : followUpForOutcome(outcome, now)

    await logActivity({
      action: callAction(outcome),
      entity_type: 'lead',
      entity_id: id,
      actor_email: actor.email || 'staff',
      details: note,
    })
    const { error } = await getSupabase()
      .from('leads')
      .update({ last_contacted_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', id)
    if (error) console.error('call contact stamp error:', error.message)

    const followChanged = followUpAt !== undefined && followUpAt !== prospect.followUpAt
    if (stage !== prospect.stage || followChanged) {
      const result = await saveMarketingProspect(id, {
        stage,
        ...(followUpAt !== undefined ? { followUpAt } : {}),
      }, actor)
      saved = result.prospect
      warning = result.warning
    } else {
      saved = (await getMarketingProspect(id)) || prospect
    }
    const wanted = callOutcome(outcome).stage
    if (wanted && wanted !== prospect.stage && stage === prospect.stage && prospect.stage !== 'won') {
      warning = [warning, 'Call logged. Your role does not move this stage, so sales will.'].filter(Boolean).join(' ')
    }
  } else {
    throw new Error('Log a call or a note')
  }

  return {
    prospect: saved,
    timeline: await loadProspectTimeline(saved),
    warning,
  }
}
