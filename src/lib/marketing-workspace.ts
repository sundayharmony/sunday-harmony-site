/**
 * The marketing workspace: one connected view of the pipeline.
 *
 * Everything here is pure so the queue, pulse, insights, account health, and
 * timeline can be tested without a database. Numbers come only from saved facts:
 * stages, timestamps on the lead, and rows in activity_log.
 */
import {
  PIPELINE_STAGES,
  SOURCE_LABELS,
  STAGE_LABELS,
  canMoveStage,
  isLeadSource,
  normalizeOnboarding,
  onboardingComplete,
  procurementHandoffGaps,
  type PipelineStage,
} from '@/lib/marketing-pipeline'

/** Calls a closer aims to log each day. The call list fills up to this. */
export const DAILY_CALL_TARGET = 25

const DAY = 24 * 60 * 60 * 1000
const ZONE = 'America/New_York'

export type WorkspaceProspect = {
  id: string
  business: string
  contactName: string
  email: string
  phone: string
  industry: string
  source: string
  stage: PipelineStage
  score: number | null
  estimatedValue: number | null
  followUpAt: string | null
  lastContactedAt: string | null
  repliedAt: string | null
  gmailThreadId: string | null
  handedToSalesAt: string | null
  handedToRelationsAt: string | null
  consultationBookedAt: string | null
  agreementSignedAt: string | null
  onboarding: unknown
  clientId: string | null
  createdAt: string
  deadline: string
  deliverables: string
  opportunity: string
  notes: string
}

export type WorkspaceActivity = {
  id: string
  leadId: string
  action: string
  details: string
  actor: string
  createdAt: string
}

// ---------- Call outcomes ----------

export const CALL_OUTCOMES = [
  { key: 'no_answer', label: 'No answer', stage: 'contacted', followUpDays: 2, conversation: false },
  { key: 'voicemail', label: 'Left voicemail', stage: 'contacted', followUpDays: 3, conversation: false },
  { key: 'talked', label: 'Talked', stage: 'contacted', followUpDays: 1, conversation: true },
  { key: 'callback', label: 'Call back later', stage: 'contacted', followUpDays: 1, conversation: true },
  { key: 'not_interested', label: 'Not interested', stage: 'lost_nurture', followUpDays: null, conversation: true },
  { key: 'wrong_number', label: 'Wrong number', stage: null, followUpDays: null, conversation: false },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  stage: PipelineStage | null
  followUpDays: number | null
  conversation: boolean
}>

export type CallOutcome = (typeof CALL_OUTCOMES)[number]['key']

export function isCallOutcome(value: unknown): value is CallOutcome {
  return CALL_OUTCOMES.some((outcome) => outcome.key === value)
}

export function callOutcome(key: CallOutcome) {
  return CALL_OUTCOMES.find((outcome) => outcome.key === key)!
}

export function callAction(outcome: CallOutcome): string {
  return `call:${outcome}`
}

export function outcomeFromAction(action: string): CallOutcome | null {
  if (!action.startsWith('call:')) return null
  const key = action.slice(5)
  return isCallOutcome(key) ? key : null
}

/**
 * Where a call leaves the lead. Calls only move a lead forward: an early lead
 * becomes Contacted, Not interested goes Inactive, and an Active client never moves.
 * The role still has to be allowed to make that move.
 */
export function stageAfterCall(
  role: string | null | undefined,
  current: PipelineStage,
  outcome: CallOutcome
): PipelineStage {
  const target = callOutcome(outcome).stage
  if (!target || current === 'won') return current
  let next: PipelineStage = current
  if (target === 'contacted' && (current === 'uncontacted' || current === 'emailed')) next = 'contacted'
  if (target === 'lost_nurture' && current !== 'lost_nurture') next = 'lost_nurture'
  return canMoveStage(role, current, next) ? next : current
}

/** Next weekday at 10:00 New York time (15:00 UTC), the given number of days out. */
export function followUpAfter(days: number, now: Date): string {
  const date = new Date(now.getTime() + days * DAY)
  date.setUTCHours(15, 0, 0, 0)
  const weekday = date.getUTCDay()
  if (weekday === 6) date.setUTCDate(date.getUTCDate() + 2)
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}

/** The follow-up a call outcome sets. undefined keeps the current one, null clears it. */
export function followUpForOutcome(outcome: CallOutcome, now: Date): string | null | undefined {
  const config = callOutcome(outcome)
  if (config.key === 'not_interested') return null
  if (config.followUpDays == null) return undefined
  return followUpAfter(config.followUpDays, now)
}

// ---------- Dates ----------

export function dayKey(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-CA', { timeZone: ZONE })
}

function time(iso: string | null | undefined): number {
  if (!iso) return Number.NaN
  return new Date(iso).getTime()
}

function daysSince(iso: string | null | undefined, now: Date): number | null {
  const at = time(iso)
  if (Number.isNaN(at)) return null
  return Math.floor((now.getTime() - at) / DAY)
}

function endOfDay(now: Date): number {
  // End of the New York day, close enough for "due today" (offset is 4 or 5 hours).
  const key = dayKey(now)
  const midnight = new Date(`${key}T00:00:00-05:00`).getTime()
  return midnight + DAY - 1
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return ''
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// ---------- Touches ----------

/** Latest activity per lead, from activity_log calls and notes. */
export function lastTouchByLead(activities: WorkspaceActivity[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of activities) {
    if (!row.action.startsWith('call:') && row.action !== 'note') continue
    const current = map.get(row.leadId)
    if (!current || current < row.createdAt) map.set(row.leadId, row.createdAt)
  }
  return map
}

function lastTouch(prospect: WorkspaceProspect, touches: Map<string, string>): string | null {
  const values = [prospect.lastContactedAt, touches.get(prospect.id) || null].filter(Boolean) as string[]
  if (values.length === 0) return null
  return values.sort().at(-1) || null
}

const OPEN = new Set<PipelineStage>(['uncontacted', 'emailed', 'contacted', 'offer_made'])

export function isOpenStage(stage: PipelineStage): boolean {
  return OPEN.has(stage)
}

// ---------- Work queue ----------

export type QueueKind =
  | 'reply'
  | 'callback'
  | 'offer'
  | 'email_no_reply'
  | 'call'
  | 'research'
  | 'ready_for_sales'
  | 'handoff_relations'
  | 'onboarding'

export type QueueItem = {
  kind: QueueKind
  id: string
  business: string
  contactName: string
  phone: string
  email: string
  stage: PipelineStage
  score: number | null
  value: number | null
  reason: string
  dueAt: string | null
  urgent: boolean
}

export type QueueGroup = {
  key: QueueKind
  title: string
  detail: string
  items: QueueItem[]
  total: number
}

const GROUPS: Record<QueueKind, { title: string; detail: string; roles: string[]; limit: number }> = {
  reply: {
    title: 'Answer replies',
    detail: 'They wrote back. Answer the same day.',
    roles: ['admin', 'sales_closer', 'lead_procurement'],
    limit: 20,
  },
  callback: {
    title: 'Callbacks due',
    detail: 'Follow-ups set for today or missed in the last 3 days.',
    roles: ['admin', 'sales_closer', 'lead_procurement'],
    limit: 20,
  },
  offer: {
    title: 'Close open offers',
    detail: 'An offer is out and nobody has touched it in 3 days.',
    roles: ['admin', 'sales_closer'],
    limit: 10,
  },
  email_no_reply: {
    title: 'Call the quiet emails',
    detail: 'Emailed more than 3 days ago with no reply. A call usually gets the answer.',
    roles: ['admin', 'sales_closer'],
    limit: 10,
  },
  call: {
    title: "Today's call list",
    detail: 'Fresh leads with a phone number, best score and value first.',
    roles: ['admin', 'sales_closer'],
    limit: DAILY_CALL_TARGET,
  },
  research: {
    title: 'Finish research',
    detail: 'Fill in what sales needs before the handoff.',
    roles: ['admin', 'lead_procurement'],
    limit: 10,
  },
  ready_for_sales: {
    title: 'Ready for sales',
    detail: 'Research is complete. Hand these to the closer.',
    roles: ['admin', 'lead_procurement'],
    limit: 10,
  },
  handoff_relations: {
    title: 'Hand paid clients to client relations',
    detail: 'Active and paid, but client relations does not have the file yet.',
    roles: ['admin', 'sales_closer'],
    limit: 10,
  },
  onboarding: {
    title: 'Finish onboarding',
    detail: 'Active clients whose onboarding checklist is still open.',
    roles: ['admin', 'client_relations'],
    limit: 10,
  },
}

export const QUEUE_ORDER: QueueKind[] = [
  'reply',
  'callback',
  'offer',
  'email_no_reply',
  'handoff_relations',
  'onboarding',
  'call',
  'ready_for_sales',
  'research',
]

function item(
  kind: QueueKind,
  prospect: WorkspaceProspect,
  reason: string,
  options: { dueAt?: string | null; urgent?: boolean } = {}
): QueueItem {
  return {
    kind,
    id: prospect.id,
    business: prospect.business,
    contactName: prospect.contactName,
    phone: prospect.phone,
    email: prospect.email,
    stage: prospect.stage,
    score: prospect.score,
    value: prospect.estimatedValue,
    reason,
    dueAt: options.dueAt ?? null,
    urgent: Boolean(options.urgent),
  }
}

function leadSummary(prospect: WorkspaceProspect): string {
  return [
    prospect.score != null ? `Score ${prospect.score}` : '',
    money(prospect.estimatedValue),
    prospect.industry,
  ].filter(Boolean).join(' · ')
}

function byValue(a: WorkspaceProspect, b: WorkspaceProspect): number {
  const score = (b.score ?? -1) - (a.score ?? -1)
  if (score !== 0) return score
  const value = (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0)
  if (value !== 0) return value
  return a.business.localeCompare(b.business)
}

/** How many calls were logged today. */
export function callsLoggedOn(activities: WorkspaceActivity[], now: Date): number {
  const today = dayKey(now)
  return activities.filter((row) => row.action.startsWith('call:') && dayKey(row.createdAt) === today).length
}

/**
 * One ranked list of what to do next. Each lead shows up once, in the most
 * urgent group it qualifies for. Groups the role does not work are left out.
 */
export function buildWorkQueue(
  prospects: WorkspaceProspect[],
  activities: WorkspaceActivity[],
  role: string,
  now: Date
): QueueGroup[] {
  const touches = lastTouchByLead(activities)
  const used = new Set<string>()
  const candidates = new Map<QueueKind, { prospect: WorkspaceProspect; entry: QueueItem; sort: number }[]>()
  const push = (kind: QueueKind, prospect: WorkspaceProspect, entry: QueueItem, sort: number) => {
    const list = candidates.get(kind) || []
    list.push({ prospect, entry, sort })
    candidates.set(kind, list)
  }
  const dayEnd = endOfDay(now)
  const recentMissed = now.getTime() - 3 * DAY

  for (const prospect of prospects) {
    const touched = lastTouch(prospect, touches)
    const touchedDays = daysSince(touched, now)
    const open = isOpenStage(prospect.stage)

    if (open && prospect.repliedAt && (!touched || touched <= prospect.repliedAt)) {
      const days = daysSince(prospect.repliedAt, now) ?? 0
      push('reply', prospect, item('reply', prospect, days <= 0 ? 'Replied today' : `Replied ${plural(days, 'day')} ago, not answered`, {
        dueAt: prospect.repliedAt,
        urgent: true,
      }), -time(prospect.repliedAt))
    }

    const followAt = time(prospect.followUpAt)
    if (open && !Number.isNaN(followAt) && followAt <= dayEnd && followAt >= recentMissed) {
      const late = followAt < now.getTime()
      const lateDays = Math.floor((now.getTime() - followAt) / DAY)
      const when = new Date(followAt).toLocaleTimeString('en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' })
      const reason = !late
        ? `Due today at ${when}`
        : lateDays >= 1
          ? `Missed ${plural(lateDays, 'day')} ago`
          : `Was due at ${when}`
      push('callback', prospect, item('callback', prospect, reason, { dueAt: prospect.followUpAt, urgent: late }), followAt)
    }

    if (prospect.stage === 'offer_made' && (touchedDays == null || touchedDays >= 3)) {
      const reason = touchedDays == null ? 'Offer made, no touch recorded' : `Offer out, last touch ${plural(touchedDays, 'day')} ago`
      push('offer', prospect, item('offer', prospect, [reason, money(prospect.estimatedValue)].filter(Boolean).join(' · ')), -(prospect.estimatedValue || 0))
    }

    if (
      prospect.stage === 'emailed' &&
      !prospect.repliedAt &&
      prospect.phone &&
      touchedDays != null &&
      touchedDays >= 3
    ) {
      push('email_no_reply', prospect, item('email_no_reply', prospect, `Emailed ${plural(touchedDays, 'day')} ago, no reply`), -((prospect.score ?? 0) * 100000 + (prospect.estimatedValue ?? 0)))
    }

    if (prospect.stage === 'uncontacted' && prospect.phone && (touchedDays == null || touchedDays >= 7)) {
      push('call', prospect, item('call', prospect, leadSummary(prospect) || 'Fresh lead'), 0)
    }

    if ((prospect.stage === 'uncontacted' || prospect.stage === 'emailed') && !prospect.handedToSalesAt) {
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
      if (gaps.length > 0) {
        push('research', prospect, item('research', prospect, `Missing: ${gaps.slice(0, 3).join(', ')}${gaps.length > 3 ? '…' : ''}`), gaps.length)
      } else {
        push('ready_for_sales', prospect, item('ready_for_sales', prospect, leadSummary(prospect) || 'Research complete'), 0)
      }
    }

    if (prospect.stage === 'won' && !prospect.handedToRelationsAt) {
      push('handoff_relations', prospect, item('handoff_relations', prospect, 'Active client, not handed to client relations yet', { urgent: true }), 0)
    }

    if (prospect.stage === 'won' && prospect.handedToRelationsAt && !onboardingComplete(prospect.onboarding)) {
      const done = Object.values(normalizeOnboarding(prospect.onboarding)).filter(Boolean).length
      push('onboarding', prospect, item('onboarding', prospect, `Onboarding ${done} of 5 done`), done)
    }
  }

  const callsToday = callsLoggedOn(activities, now)
  const groups: QueueGroup[] = []
  for (const kind of QUEUE_ORDER) {
    const config = GROUPS[kind]
    if (!config.roles.includes(role)) continue
    let rows = (candidates.get(kind) || []).filter(({ prospect }) => !used.has(prospect.id))
    if (kind === 'call') rows = rows.sort((a, b) => byValue(a.prospect, b.prospect))
    else if (kind === 'ready_for_sales') rows = rows.sort((a, b) => byValue(a.prospect, b.prospect))
    else rows = rows.sort((a, b) => a.sort - b.sort || a.prospect.business.localeCompare(b.prospect.business))
    const limit = kind === 'call' ? Math.max(5, DAILY_CALL_TARGET - callsToday) : config.limit
    const shown = rows.slice(0, limit)
    for (const row of shown) used.add(row.prospect.id)
    if (rows.length === 0) continue
    groups.push({ key: kind, title: config.title, detail: config.detail, items: shown.map((row) => row.entry), total: rows.length })
  }
  return groups
}

// ---------- Pulse ----------

export type PulseStage = { stage: PipelineStage; label: string; count: number; value: number }

export type WorkspacePulse = {
  stages: PulseStage[]
  openValue: number
  wonValue: number
  callsToday: number
  conversationsToday: number
  notesToday: number
  repliesWaiting: number
  callbacksDue: number
  target: number
}

export function workspacePulse(
  prospects: WorkspaceProspect[],
  activities: WorkspaceActivity[],
  queue: QueueGroup[],
  now: Date
): WorkspacePulse {
  const stages = PIPELINE_STAGES.map((stage) => {
    const rows = prospects.filter((prospect) => prospect.stage === stage)
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: rows.length,
      value: rows.reduce((sum, row) => sum + (Number(row.estimatedValue) || 0), 0),
    }
  })
  const today = dayKey(now)
  const todays = activities.filter((row) => dayKey(row.createdAt) === today)
  const conversation = new Set<string>(CALL_OUTCOMES.filter((o) => o.conversation).map((o) => callAction(o.key)))
  return {
    stages,
    openValue: stages.filter((row) => isOpenStage(row.stage)).reduce((sum, row) => sum + row.value, 0),
    wonValue: stages.find((row) => row.stage === 'won')?.value || 0,
    callsToday: todays.filter((row) => row.action.startsWith('call:')).length,
    conversationsToday: todays.filter((row) => conversation.has(row.action)).length,
    notesToday: todays.filter((row) => row.action === 'note').length,
    repliesWaiting: queue.find((group) => group.key === 'reply')?.total || 0,
    callbacksDue: queue.find((group) => group.key === 'callback')?.total || 0,
    target: DAILY_CALL_TARGET,
  }
}

// ---------- Insights ----------

export type FunnelStep = { key: string; label: string; count: number; rate: string }
export type SegmentRow = { key: string; label: string; total: number; reached: number; offers: number; won: number; value: number }
export type ActivityDay = { day: string; calls: number; conversations: number; notes: number }

export type WorkspaceInsights = {
  funnel: FunnelStep[]
  activity: ActivityDay[]
  sources: SegmentRow[]
  industries: SegmentRow[]
  scoreBands: SegmentRow[]
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

function reached(prospect: WorkspaceProspect, conversations: Set<string>, touched: Set<string>): boolean {
  return Boolean(
    prospect.gmailThreadId ||
    prospect.lastContactedAt ||
    touched.has(prospect.id) ||
    conversations.has(prospect.id) ||
    prospect.stage === 'contacted' ||
    prospect.stage === 'offer_made' ||
    prospect.stage === 'won'
  )
}

function talkedTo(prospect: WorkspaceProspect, conversations: Set<string>): boolean {
  return Boolean(prospect.repliedAt || conversations.has(prospect.id) || prospect.stage === 'offer_made' || prospect.stage === 'won')
}

function industryKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

function segment(
  prospects: WorkspaceProspect[],
  keyOf: (prospect: WorkspaceProspect) => { key: string; label: string },
  conversations: Set<string>,
  touched: Set<string>,
  limit: number
): SegmentRow[] {
  const rows = new Map<string, SegmentRow>()
  for (const prospect of prospects) {
    const { key, label } = keyOf(prospect)
    const row = rows.get(key) || { key, label, total: 0, reached: 0, offers: 0, won: 0, value: 0 }
    row.total += 1
    if (reached(prospect, conversations, touched)) row.reached += 1
    if (prospect.stage === 'offer_made' || prospect.stage === 'won') row.offers += 1
    if (prospect.stage === 'won') row.won += 1
    if (isOpenStage(prospect.stage)) row.value += Number(prospect.estimatedValue) || 0
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)).slice(0, limit)
}

export function workspaceInsights(
  prospects: WorkspaceProspect[],
  activities: WorkspaceActivity[],
  now: Date,
  days = 14
): WorkspaceInsights {
  const conversationActions = new Set<string>(CALL_OUTCOMES.filter((o) => o.conversation).map((o) => callAction(o.key)))
  const conversations = new Set(activities.filter((row) => conversationActions.has(row.action)).map((row) => row.leadId))
  const touched = new Set(activities.filter((row) => row.action.startsWith('call:')).map((row) => row.leadId))

  const total = prospects.length
  const reachedCount = prospects.filter((p) => reached(p, conversations, touched)).length
  const talked = prospects.filter((p) => talkedTo(p, conversations)).length
  const offers = prospects.filter((p) => p.stage === 'offer_made' || p.stage === 'won').length
  const won = prospects.filter((p) => p.stage === 'won').length
  const funnel: FunnelStep[] = [
    { key: 'leads', label: 'Leads on file', count: total, rate: '' },
    { key: 'reached', label: 'Reached out', count: reachedCount, rate: percent(reachedCount, total) },
    { key: 'talked', label: 'Had a conversation', count: talked, rate: percent(talked, reachedCount) },
    { key: 'offers', label: 'Offer made', count: offers, rate: percent(offers, talked) },
    { key: 'won', label: 'Active client', count: won, rate: percent(won, offers) },
  ]

  const activity: ActivityDay[] = []
  const index = new Map<string, ActivityDay>()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = dayKey(new Date(now.getTime() - offset * DAY))
    const row = { day, calls: 0, conversations: 0, notes: 0 }
    activity.push(row)
    index.set(day, row)
  }
  for (const row of activities) {
    const bucket = index.get(dayKey(row.createdAt))
    if (!bucket) continue
    if (row.action.startsWith('call:')) bucket.calls += 1
    if (conversationActions.has(row.action)) bucket.conversations += 1
    if (row.action === 'note') bucket.notes += 1
  }

  const firstLabel = new Map<string, string>()
  for (const prospect of prospects) {
    const key = industryKey(prospect.industry)
    if (key && !firstLabel.has(key)) firstLabel.set(key, prospect.industry.trim())
  }

  return {
    funnel,
    activity,
    sources: segment(prospects, (p) => {
      const key = p.source === 'inbound' ? 'website' : p.source
      return { key, label: isLeadSource(key) ? SOURCE_LABELS[key] : key || 'Unknown' }
    }, conversations, touched, 8),
    industries: segment(prospects, (p) => {
      const key = industryKey(p.industry) || 'unknown'
      return { key, label: firstLabel.get(key) || 'Not set' }
    }, conversations, touched, 10),
    scoreBands: segment(prospects, (p) => {
      if (p.score == null) return { key: 'none', label: 'Not scored' }
      if (p.score >= 8) return { key: 'high', label: 'High (8–10)' }
      if (p.score >= 5) return { key: 'medium', label: 'Medium (5–7)' }
      return { key: 'low', label: 'Low (0–4)' }
    }, conversations, touched, 4),
  }
}

// ---------- Client accounts ----------

export type AccountTask = { clientId: string; status: string; dueDate: string | null; title?: string }
export type AccountClient = {
  id: string
  billing_status?: string | null
  last_payment_at?: string | null
  monthly_price?: number | null
  package_tier?: string | null
}

export type ClientAccount = {
  id: string
  business: string
  contactName: string
  phone: string
  email: string
  clientId: string | null
  handedToRelations: boolean
  onboardingDone: number
  onboardingTotal: number
  deadline: string
  deliverables: string
  openTasks: number
  overdueTasks: number
  nextTask: { title: string; dueDate: string } | null
  billing: string
  monthly: number
  health: 'on_track' | 'attention' | 'at_risk'
  reasons: string[]
}

const BILLING_LABELS: Record<string, string> = {
  paid: 'Paid',
  trial: 'Trial',
  past_due: 'Past due',
  unpaid: 'Unpaid',
  not_started: 'Not billed',
}

export function clientAccounts(
  prospects: WorkspaceProspect[],
  tasks: AccountTask[],
  clients: AccountClient[],
  now: Date
): ClientAccount[] {
  const today = dayKey(now)
  const clientById = new Map(clients.map((client) => [client.id, client]))
  const accounts = prospects
    .filter((prospect) => prospect.stage === 'won')
    .map((prospect): ClientAccount => {
      const own = prospect.clientId ? tasks.filter((task) => task.clientId === prospect.clientId) : []
      const open = own.filter((task) => task.status !== 'completed')
      const overdue = open.filter((task) => task.dueDate && task.dueDate < today)
      const next = open
        .filter((task) => task.dueDate)
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0]
      const client = prospect.clientId ? clientById.get(prospect.clientId) : undefined
      const billingKey = client?.last_payment_at ? 'paid' : client?.billing_status || 'not_started'
      const done = Object.values(normalizeOnboarding(prospect.onboarding)).filter(Boolean).length
      const reasons: string[] = []
      if (overdue.length > 0) reasons.push(`${plural(overdue.length, 'task')} overdue`)
      if (billingKey === 'past_due' || billingKey === 'unpaid') reasons.push(`Billing ${BILLING_LABELS[billingKey].toLowerCase()}`)
      const atRisk = reasons.length > 0
      if (!prospect.handedToRelationsAt) reasons.push('Not handed to client relations')
      if (done < 5) reasons.push(`Onboarding ${done} of 5`)
      if (billingKey === 'not_started') reasons.push('Not billed yet')
      if (!prospect.clientId) reasons.push('No client record')
      return {
        id: prospect.id,
        business: prospect.business,
        contactName: prospect.contactName,
        phone: prospect.phone,
        email: prospect.email,
        clientId: prospect.clientId,
        handedToRelations: Boolean(prospect.handedToRelationsAt),
        onboardingDone: done,
        onboardingTotal: 5,
        deadline: prospect.deadline,
        deliverables: prospect.deliverables,
        openTasks: open.length,
        overdueTasks: overdue.length,
        nextTask: next ? { title: next.title || 'Task', dueDate: String(next.dueDate) } : null,
        billing: BILLING_LABELS[billingKey] || billingKey,
        monthly: Number(client?.monthly_price) || 0,
        health: atRisk ? 'at_risk' : reasons.length > 0 ? 'attention' : 'on_track',
        reasons,
      }
    })
  const rank = { at_risk: 0, attention: 1, on_track: 2 }
  return accounts.sort((a, b) => rank[a.health] - rank[b.health] || a.business.localeCompare(b.business))
}

// ---------- Timeline ----------

export type TimelineEntry = {
  at: string
  kind: 'call' | 'note' | 'email' | 'reply' | 'update' | 'milestone'
  title: string
  detail: string
  actor: string
}

function actorName(email: string): string {
  if (!email || email === 'staff' || email === 'system') return ''
  return email.split('@')[0]
}

/** Logged activity plus the milestones already stamped on the lead, newest first. */
export function prospectTimeline(prospect: WorkspaceProspect, activities: WorkspaceActivity[]): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const own = activities.filter((row) => row.leadId === prospect.id)
  for (const row of own) {
    const outcome = outcomeFromAction(row.action)
    if (outcome) {
      entries.push({ at: row.createdAt, kind: 'call', title: `Call · ${callOutcome(outcome).label}`, detail: row.details, actor: actorName(row.actor) })
    } else if (row.action === 'note') {
      entries.push({ at: row.createdAt, kind: 'note', title: 'Note', detail: row.details, actor: actorName(row.actor) })
    } else if (row.action === 'status_changed') {
      const stage = /\(([a-z_]+)\)\s*$/.exec(row.details || '')?.[1]
      const label = stage && (PIPELINE_STAGES as readonly string[]).includes(stage) ? STAGE_LABELS[stage as PipelineStage] : ''
      entries.push({ at: row.createdAt, kind: 'update', title: 'File updated', detail: label ? `Stage: ${label}` : '', actor: actorName(row.actor) })
    } else if (row.action === 'lead_created') {
      entries.push({ at: row.createdAt, kind: 'milestone', title: 'Added to the CRM', detail: '', actor: actorName(row.actor) })
    }
  }

  const callTimes = own.filter((row) => row.action.startsWith('call:')).map((row) => time(row.createdAt))
  const milestone = (at: string | null, kind: TimelineEntry['kind'], title: string) => {
    if (!at || Number.isNaN(time(at))) return
    entries.push({ at, kind, title, detail: '', actor: '' })
  }
  if (!own.some((row) => row.action === 'lead_created')) milestone(prospect.createdAt, 'milestone', 'Added to the CRM')
  const contacted = time(prospect.lastContactedAt)
  if (prospect.gmailThreadId && !Number.isNaN(contacted) && !callTimes.some((at) => Math.abs(at - contacted) < 120000)) {
    milestone(prospect.lastContactedAt, 'email', 'Email sent')
  }
  milestone(prospect.repliedAt, 'reply', 'Replied by email')
  milestone(prospect.handedToSalesAt, 'milestone', 'Handed to sales')
  milestone(prospect.consultationBookedAt, 'milestone', 'Consultation booked')
  milestone(prospect.agreementSignedAt, 'milestone', 'Agreement signed')
  milestone(prospect.handedToRelationsAt, 'milestone', 'Handed to client relations')
  return entries.sort((a, b) => b.at.localeCompare(a.at))
}
