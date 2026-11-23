/**
 * The Credit desk: one view of every credit and funding client.
 *
 * Pure and testable. Inputs are operational fields only (status, dates, counts,
 * fee amounts). No SSNs, birth dates, reports, bureau logins, or message text.
 */
import {
  STATUS_LABELS,
  getNextWorkflowStatus,
  isTerminalStatus,
  type ApplicationStatus,
} from '@/lib/credit-funding-types'

const DAY = 24 * 60 * 60 * 1000

export type DeskRoundStatus = 'draft' | 'letters_ready' | 'mailed' | 'awaiting_response' | 'closed'

export type DeskRound = {
  id: string
  applicationUuid: string
  roundNumber: number
  status: DeskRoundStatus
  sessionId: string | null
  startedAt: string | null
  mailedAt: string | null
  deliveredAt: string | null
  deadlineAt: string | null
}

export type DeskItemCounts = {
  pending: number
  selected: number
  disputed: number
  deleted: number
  updated: number
  verified: number
  other: number
}

export type DeskClient = {
  id: string
  applicationId: string
  name: string
  email: string
  phone: string
  status: ApplicationStatus
  serviceType: string
  assignedSpecialist: string | null
  expertName: string
  clientId: string | null
  createdAt: string
  updatedAt: string
  /** Latest staff and applicant message times. Text never enters the desk. */
  lastApplicantMessageAt: string | null
  lastStaffMessageAt: string | null
  pendingRequests: number
  oldestPendingRequestAt: string | null
  feeCents: number | null
  feePaidAt: string | null
  billingModel: string | null
  rounds: DeskRound[]
  items: DeskItemCounts
}

export function emptyItemCounts(): DeskItemCounts {
  return { pending: 0, selected: 0, disputed: 0, deleted: 0, updated: 0, verified: 0, other: 0 }
}

export function addItemStatus(counts: DeskItemCounts, status: string): DeskItemCounts {
  if (status === 'pending') counts.pending += 1
  else if (status === 'selected_for_round') counts.selected += 1
  else if (status === 'disputed') counts.disputed += 1
  else if (status === 'deleted') counts.deleted += 1
  else if (status === 'updated') counts.updated += 1
  else if (status === 'verified') counts.verified += 1
  else counts.other += 1
  return counts
}

export function needsFunding(serviceType: string): boolean {
  return serviceType !== 'credit_repair'
}

function time(iso: string | null | undefined): number {
  if (!iso) return Number.NaN
  return new Date(iso).getTime()
}

function daysSince(iso: string | null | undefined, now: Date): number {
  const at = time(iso)
  if (Number.isNaN(at)) return 0
  return Math.max(0, Math.floor((now.getTime() - at) / DAY))
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function money(cents: number | null | undefined): string {
  const value = Number(cents) / 100
  if (!Number.isFinite(value) || value <= 0) return '$0'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// ---------- Phases ----------

export const DESK_PHASES = ['intake', 'review', 'disputing', 'funding', 'done'] as const
export type DeskPhase = (typeof DESK_PHASES)[number]

export const PHASE_LABELS: Record<DeskPhase, string> = {
  intake: 'Intake',
  review: 'Review',
  disputing: 'Disputing',
  funding: 'Funding',
  done: 'Done',
}

export const PHASE_DETAIL: Record<DeskPhase, string> = {
  intake: 'Invited or drafted. Waiting for the client to finish the application.',
  review: 'Submitted. Check documents, pull the report, and start the first round.',
  disputing: 'Letters out or being prepared. Track each round to its bureau deadline.',
  funding: 'Credit work is done or underway. Evaluating and approving funding.',
  done: 'Completed, declined, or archived.',
}

export function openRound(client: Pick<DeskClient, 'rounds'>): DeskRound | null {
  const open = client.rounds.filter((round) => round.status !== 'closed')
  return open.sort((a, b) => b.roundNumber - a.roundNumber)[0] || null
}

/**
 * Where a client really is. The application status alone lags behind the work:
 * a client still "Under review" with letters in the mail is disputing.
 */
export function clientPhase(client: Pick<DeskClient, 'status' | 'rounds' | 'items'>): DeskPhase {
  if (isTerminalStatus(client.status)) return 'done'
  if (client.status === 'draft' || client.status === 'invitation_pending') return 'intake'
  if (client.status === 'funding_review' || client.status === 'approved') return 'funding'
  const disputing = Boolean(openRound(client as DeskClient)) || client.items.disputed > 0 || client.items.selected > 0
  if (disputing || client.status === 'credit_analysis_complete') return 'disputing'
  return 'review'
}

/** Days left before the bureau response deadline (negative when past). */
export function deadlineDays(round: Pick<DeskRound, 'deadlineAt'>, now: Date): number | null {
  const at = time(round.deadlineAt)
  if (Number.isNaN(at)) return null
  return Math.ceil((at - now.getTime()) / DAY)
}

export function clientWaitingOnUs(client: Pick<DeskClient, 'lastApplicantMessageAt' | 'lastStaffMessageAt'>): boolean {
  if (!client.lastApplicantMessageAt) return false
  return !client.lastStaffMessageAt || client.lastStaffMessageAt < client.lastApplicantMessageAt
}

export function feeOwed(client: Pick<DeskClient, 'billingModel' | 'feeCents' | 'feePaidAt' | 'clientId'>): boolean {
  return Boolean(client.clientId && client.billingModel === 'credit_repair_one_time' && (client.feeCents || 0) > 0 && !client.feePaidAt)
}

// ---------- Work queue ----------

export type CreditQueueKind =
  | 'client_waiting'
  | 'deadline_passed'
  | 'letters_ready'
  | 'new_submission'
  | 'deadline_soon'
  | 'docs_waiting'
  | 'fee_unpaid'
  | 'stale_invite'
  | 'unassigned'

export type CreditQueueItem = {
  kind: CreditQueueKind
  id: string
  name: string
  applicationId: string
  status: ApplicationStatus
  phase: DeskPhase
  reason: string
  urgent: boolean
  unassigned: boolean
  /** The next status this client moves to from the queue, if one applies. */
  advanceTo: ApplicationStatus | null
}

export type CreditQueueGroup = {
  key: CreditQueueKind
  title: string
  detail: string
  items: CreditQueueItem[]
  total: number
}

const GROUPS: Record<CreditQueueKind, { title: string; detail: string; adminOnly?: boolean }> = {
  client_waiting: { title: 'Reply to clients', detail: 'They wrote last. Answer the same day.' },
  deadline_passed: { title: 'Bureau deadlines passed', detail: 'Record what came back, or prepare the next round or a CFPB complaint.' },
  letters_ready: { title: 'Mail letters', detail: 'Letters are generated but not marked mailed. Mail certified and log the tracking number.' },
  new_submission: { title: 'Start new reviews', detail: 'Submitted applications nobody has started.' },
  deadline_soon: { title: 'Responses due this week', detail: 'Bureau deadlines in the next 7 days. Watch the mail and the client portal.' },
  docs_waiting: { title: 'Waiting on documents', detail: 'Requested more than 3 days ago. Nudge the client.' },
  fee_unpaid: { title: 'Collect repair fees', detail: 'Work has started but the one-time fee is not paid.' },
  stale_invite: { title: 'Unfinished invites', detail: 'Invited more than 7 days ago and never submitted. Resend or archive.' },
  unassigned: { title: 'Assign a credit expert', detail: 'Active clients with nobody responsible.', adminOnly: true },
}

export const CREDIT_QUEUE_ORDER: CreditQueueKind[] = [
  'client_waiting',
  'deadline_passed',
  'letters_ready',
  'new_submission',
  'deadline_soon',
  'docs_waiting',
  'fee_unpaid',
  'stale_invite',
  'unassigned',
]

export function buildCreditQueue(clients: DeskClient[], role: string, now: Date): CreditQueueGroup[] {
  const buckets = new Map<CreditQueueKind, { item: CreditQueueItem; sort: number }[]>()
  for (const client of clients) {
    if (isTerminalStatus(client.status)) continue
    const phase = clientPhase(client)
    const base = {
      id: client.id,
      name: client.name || 'Unnamed client',
      applicationId: client.applicationId,
      status: client.status,
      phase,
      unassigned: !client.assignedSpecialist,
    }
    const add = (kind: CreditQueueKind, reason: string, sort: number, extra: Partial<CreditQueueItem> = {}) => {
      const list = buckets.get(kind) || []
      list.push({ item: { kind, ...base, reason, urgent: false, advanceTo: null, ...extra }, sort })
      buckets.set(kind, list)
    }

    if (clientWaitingOnUs(client)) {
      const days = daysSince(client.lastApplicantMessageAt, now)
      add('client_waiting', days === 0 ? 'Wrote today' : `Wrote ${plural(days, 'day')} ago, no reply yet`, -time(client.lastApplicantMessageAt), { urgent: days >= 1 })
    }

    const round = openRound(client)
    if (round) {
      const left = deadlineDays(round, now)
      if ((round.status === 'mailed' || round.status === 'awaiting_response') && left != null && left < 0) {
        add('deadline_passed', `Round ${round.roundNumber} deadline passed ${plural(-left, 'day')} ago`, left, { urgent: true })
      } else if (round.status === 'letters_ready') {
        const days = daysSince(round.startedAt, now)
        add('letters_ready', `Round ${round.roundNumber} letters ready${days ? ` for ${plural(days, 'day')}` : ''}`, -days, { urgent: days >= 3 })
      } else if ((round.status === 'mailed' || round.status === 'awaiting_response') && left != null && left <= 7) {
        add('deadline_soon', left === 0 ? `Round ${round.roundNumber} responses due today` : `Round ${round.roundNumber} responses due in ${plural(left, 'day')}`, left)
      }
    }

    if (client.status === 'submitted') {
      const days = daysSince(client.createdAt, now)
      add('new_submission', `Submitted ${days === 0 ? 'today' : `${plural(days, 'day')} ago`}`, -days, {
        urgent: days >= 2,
        advanceTo: getNextWorkflowStatus(client.status, needsFunding(client.serviceType)),
      })
    }

    const waitingSince = client.oldestPendingRequestAt
      || (client.status === 'documents_pending' || client.status === 'additional_information_requested' ? client.updatedAt : null)
    if (waitingSince && daysSince(waitingSince, now) >= 3) {
      const days = daysSince(waitingSince, now)
      const what = client.pendingRequests > 0 ? plural(client.pendingRequests, 'document') : 'more information'
      add('docs_waiting', `Waiting ${plural(days, 'day')} for ${what}`, -days)
    }

    if (feeOwed(client) && phase !== 'intake') {
      add('fee_unpaid', `${money(client.feeCents)} repair fee unpaid`, -(client.feeCents || 0))
    }

    if (client.status === 'invitation_pending' && daysSince(client.updatedAt, now) >= 7) {
      add('stale_invite', `Invited ${plural(daysSince(client.updatedAt, now), 'day')} ago`, -daysSince(client.updatedAt, now))
    }

    if (!client.assignedSpecialist && phase !== 'intake') {
      add('unassigned', `${PHASE_LABELS[phase]} · ${STATUS_LABELS[client.status]}`, 0)
    }
  }

  const used = new Set<string>()
  const groups: CreditQueueGroup[] = []
  for (const kind of CREDIT_QUEUE_ORDER) {
    const config = GROUPS[kind]
    if (config.adminOnly && role !== 'admin') continue
    const rows = (buckets.get(kind) || [])
      .filter(({ item }) => !used.has(item.id))
      .sort((a, b) => a.sort - b.sort || a.item.name.localeCompare(b.item.name))
    if (rows.length === 0) continue
    for (const { item } of rows) used.add(item.id)
    groups.push({ key: kind, title: config.title, detail: config.detail, items: rows.map((row) => row.item), total: rows.length })
  }
  return groups
}

// ---------- Pulse ----------

export type CreditPulse = {
  phases: { phase: DeskPhase; label: string; count: number }[]
  openRounds: number
  lettersToMail: number
  deadlinesThisWeek: number
  itemsInDispute: number
  itemsRemoved: number
  feesCollectedCents: number
  feesOwedCents: number
  unassigned: number
}

export function creditPulse(clients: DeskClient[], now: Date): CreditPulse {
  const phases = DESK_PHASES.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    count: clients.filter((client) => clientPhase(client) === phase).length,
  }))
  const rounds = clients.map(openRound).filter((round): round is DeskRound => Boolean(round))
  return {
    phases,
    openRounds: rounds.length,
    lettersToMail: rounds.filter((round) => round.status === 'letters_ready').length,
    deadlinesThisWeek: rounds.filter((round) => {
      const left = deadlineDays(round, now)
      return (round.status === 'mailed' || round.status === 'awaiting_response') && left != null && left <= 7
    }).length,
    itemsInDispute: clients.reduce((sum, client) => sum + client.items.disputed + client.items.selected, 0),
    itemsRemoved: clients.reduce((sum, client) => sum + client.items.deleted, 0),
    feesCollectedCents: clients.filter((client) => client.feePaidAt).reduce((sum, client) => sum + (client.feeCents || 0), 0),
    feesOwedCents: clients.filter(feeOwed).reduce((sum, client) => sum + (client.feeCents || 0), 0),
    unassigned: clients.filter((client) => !client.assignedSpecialist && !isTerminalStatus(client.status) && clientPhase(client) !== 'intake').length,
  }
}

// ---------- Rounds tracker ----------

export type RoundRow = DeskRound & {
  name: string
  clientUuid: string
  daysLeft: number | null
  label: string
}

const ROUND_LABELS: Record<DeskRoundStatus, string> = {
  draft: 'Preparing',
  letters_ready: 'Letters ready',
  mailed: 'Mailed',
  awaiting_response: 'Awaiting response',
  closed: 'Closed',
}

export function roundStatusLabel(status: DeskRoundStatus): string {
  return ROUND_LABELS[status] || status
}

/** Every open round across clients, most pressing first. */
export function roundsTracker(clients: DeskClient[], now: Date): RoundRow[] {
  const rank: Record<DeskRoundStatus, number> = { letters_ready: 1, awaiting_response: 2, mailed: 2, draft: 3, closed: 9 }
  return clients
    .flatMap((client) => client.rounds
      .filter((round) => round.status !== 'closed')
      .map((round) => ({
        ...round,
        name: client.name || 'Unnamed client',
        clientUuid: client.id,
        daysLeft: deadlineDays(round, now),
        label: ROUND_LABELS[round.status],
      })))
    .sort((a, b) => {
      const pastA = a.daysLeft != null && a.daysLeft < 0 ? 0 : 1
      const pastB = b.daysLeft != null && b.daysLeft < 0 ? 0 : 1
      if (pastA !== pastB) return pastA - pastB
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
      return (a.daysLeft ?? 999) - (b.daysLeft ?? 999) || a.name.localeCompare(b.name)
    })
}

// ---------- Insights ----------

export type CreditInsights = {
  outcomes: { key: keyof DeskItemCounts; label: string; count: number }[]
  resolvedRate: string
  roundsByNumber: { round: number; open: number; closed: number }[]
  services: { key: string; label: string; count: number }[]
  feeCollection: { paid: number; owed: number; notSet: number }
}

const SERVICE_LABELS: Record<string, string> = {
  credit_repair: 'Credit repair',
  credit_and_funding: 'Credit + funding',
  business_funding: 'Business funding',
}

export function creditInsights(clients: DeskClient[]): CreditInsights {
  const totals = clients.reduce((sum, client) => {
    for (const key of Object.keys(sum) as (keyof DeskItemCounts)[]) sum[key] += client.items[key]
    return sum
  }, emptyItemCounts())
  const outcomes: CreditInsights['outcomes'] = [
    { key: 'pending', label: 'Found, not yet disputed', count: totals.pending },
    { key: 'selected', label: 'Queued for a round', count: totals.selected },
    { key: 'disputed', label: 'In dispute', count: totals.disputed },
    { key: 'deleted', label: 'Deleted', count: totals.deleted },
    { key: 'updated', label: 'Updated', count: totals.updated },
    { key: 'verified', label: 'Verified (stayed)', count: totals.verified },
    { key: 'other', label: 'Other outcomes', count: totals.other },
  ]
  const answered = totals.deleted + totals.updated + totals.verified + totals.other
  const byNumber = new Map<number, { round: number; open: number; closed: number }>()
  for (const round of clients.flatMap((client) => client.rounds)) {
    const row = byNumber.get(round.roundNumber) || { round: round.roundNumber, open: 0, closed: 0 }
    if (round.status === 'closed') row.closed += 1
    else row.open += 1
    byNumber.set(round.roundNumber, row)
  }
  const services = new Map<string, number>()
  for (const client of clients) services.set(client.serviceType || 'unknown', (services.get(client.serviceType || 'unknown') || 0) + 1)
  const repair = clients.filter((client) => client.billingModel === 'credit_repair_one_time')
  return {
    outcomes,
    resolvedRate: answered > 0 ? `${Math.round(((totals.deleted + totals.updated) / answered) * 100)}%` : '—',
    roundsByNumber: [...byNumber.values()].sort((a, b) => a.round - b.round),
    services: [...services.entries()]
      .map(([key, count]) => ({ key, label: SERVICE_LABELS[key] || key, count }))
      .sort((a, b) => b.count - a.count),
    feeCollection: {
      paid: repair.filter((client) => client.feePaidAt).length,
      owed: repair.filter(feeOwed).length,
      notSet: repair.filter((client) => !client.feePaidAt && !(client.feeCents || 0)).length,
    },
  }
}
