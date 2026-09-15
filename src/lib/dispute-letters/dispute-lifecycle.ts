import { accountForBureau, isNegativeTradeline, tradelineCoversBureau } from '@/lib/dispute-letters/bureau-coverage'
import { isInquiryTradeline } from '@/lib/dispute-letters/dispute-reasons'
import { isRecommendedDispute } from '@/lib/dispute-letters/dispute-selection'
import { accountDigits, tradelineMatchKey } from '@/lib/dispute-letters/tradeline-progress'
import type { BureauCode, Tradeline } from '@/lib/dispute-letters/types'

/** Round 1 industry rule: keep first-round bureau letters focused. */
export const ROUND_1_MAX_ITEMS_PER_BUREAU = 5

export type DisputeCaseStatus = 'active' | 'paused' | 'completed'
export type DisputeRoundStatus =
  | 'draft'
  | 'letters_ready'
  | 'mailed'
  | 'awaiting_response'
  | 'closed'
export type DisputeItemStatus =
  | 'pending'
  | 'selected_for_round'
  | 'disputed'
  | 'deleted'
  | 'verified'
  | 'updated'
  | 'no_response'
  | 'frivolous'
  | 'withdrawn'

export interface DisputeCaseRow {
  id: string
  application_uuid: string | null
  status: DisputeCaseStatus
  created_at: string
  updated_at: string
}

export type DisputeMailMethod = 'certified' | 'priority' | 'other'
export type DisputeResponseSource = 'bureau' | 'furnisher' | 'collector' | 'cfpb' | 'other'
export type DisputeCfpbStatus = 'draft' | 'submitted' | 'agency_response' | 'closed'
export type FollowUpLetterType =
  | 'bureau_equifax'
  | 'bureau_experian'
  | 'bureau_transunion'
  | 'furnisher'
  | 'method_of_verification'
  | 'warning_intent'
  | 'reinvestigation'
  | 'debt_validation'
  | 'cfpb_complaint'

export interface DisputePacketChecklist {
  photo_id?: boolean
  mail_proof?: boolean
  letters_printed?: boolean
  return_receipt?: boolean
}

export interface DisputeRoundRow {
  id: string
  case_id: string
  round_number: number
  status: DisputeRoundStatus
  session_id: string | null
  notes: string | null
  started_at: string
  mailed_at: string | null
  mail_method?: DisputeMailMethod | null
  tracking_number?: string | null
  delivered_at?: string | null
  deadline_at?: string | null
  packet_checklist?: DisputePacketChecklist | null
  client_released_at?: string | null
  created_at: string
  updated_at: string
}

export interface DisputeResponseRow {
  id: string
  round_id: string
  item_id: string | null
  source: DisputeResponseSource
  file_name: string
  storage_path: string
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

export interface DisputeCfpbEscalationRow {
  id: string
  case_id: string
  item_ids: string[]
  status: DisputeCfpbStatus
  complaint_markdown: string
  submitted_at: string | null
  agency_response_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DisputeItemRow {
  id: string
  case_id: string
  match_key: string
  creditor_name: string
  account_last4: string
  bureau: BureauCode
  account_type: string
  current_status: DisputeItemStatus
  last_round_number: number | null
  last_letter_type: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DisputeLifecycleSnapshot {
  case: DisputeCaseRow | null
  rounds: DisputeRoundRow[]
  items: DisputeItemRow[]
  /** Remaining report negatives / inquiries that have not been mailed in a round. */
  notYetDisputed: DisputeItemRow[]
  pendingQueue: DisputeItemRow[]
  activeRound: DisputeRoundRow | null
}

export interface RoundSelectionInput {
  tradeline: Tradeline
  bureaus: BureauCode[]
}

export interface Round1CapResult {
  ok: boolean
  counts: Partial<Record<BureauCode, number>>
  violations: { bureau: BureauCode; count: number; max: number }[]
  message?: string
}

export interface ItemIdentity {
  matchKey: string
  creditorName: string
  accountLast4: string
  bureau: BureauCode
  accountType: string
}

/** Statuses for accounts that have not been included in a mailed round yet. */
export const NOT_YET_DISPUTED_STATUSES: DisputeItemStatus[] = [
  'pending',
  'selected_for_round',
]

/** Bureau-reply / in-flight statuses that still need work in a later round. */
export const NEEDS_NEXT_ROUND_STATUSES: DisputeItemStatus[] = [
  'no_response',
  'verified',
  'updated',
  'disputed',
]

const BUREAU_CODES: BureauCode[] = ['TUC', 'EXP', 'EQF']

function sortQueueItems(items: DisputeItemRow[]): DisputeItemRow[] {
  return [...items].sort((a, b) => {
    const bureauCmp = a.bureau.localeCompare(b.bureau)
    if (bureauCmp !== 0) return bureauCmp
    return a.creditor_name.localeCompare(b.creditor_name)
  })
}

export function isRoundClosedForNext(status: DisputeRoundStatus): boolean {
  return status === 'mailed' || status === 'closed' || status === 'awaiting_response'
}

export function nextRoundNumber(rounds: { round_number: number }[]): number {
  if (!rounds.length) return 1
  return Math.max(...rounds.map((r) => r.round_number)) + 1
}

export function notYetDisputedFromItems(items: DisputeItemRow[]): DisputeItemRow[] {
  return sortQueueItems(items.filter((i) => NOT_YET_DISPUTED_STATUSES.includes(i.current_status)))
}

export function pendingQueueFromItems(items: DisputeItemRow[]): DisputeItemRow[] {
  return sortQueueItems(items.filter((i) => NEEDS_NEXT_ROUND_STATUSES.includes(i.current_status)))
}

/** Negatives, inquiries, and recommended disputes should appear in the item queue. */
export function isDisputeCandidateTradeline(tl: Tradeline): boolean {
  return isNegativeTradeline(tl) || isInquiryTradeline(tl) || isRecommendedDispute(tl)
}

/**
 * Expand remaining dispute candidates into per-bureau identities.
 * Selected-for-round rows are created separately; this covers accounts not yet in a letter.
 */
export function pendingIdentitiesFromTradelines(tradelines: Tradeline[]): ItemIdentity[] {
  const out: ItemIdentity[] = []
  const seen = new Set<string>()
  for (const tl of tradelines) {
    if (!isDisputeCandidateTradeline(tl)) continue
    for (const bureau of BUREAU_CODES) {
      if (!tradelineCoversBureau(tl, bureau)) continue
      const identity = itemIdentityFromTradeline(tl, bureau)
      if (!identity || seen.has(identity.matchKey)) continue
      seen.add(identity.matchKey)
      out.push(identity)
    }
  }
  return out
}

export function countSelectionsPerBureau(
  selections: RoundSelectionInput[]
): Partial<Record<BureauCode, number>> {
  const counts: Partial<Record<BureauCode, number>> = {}
  for (const sel of selections) {
    for (const bureau of sel.bureaus) {
      counts[bureau] = (counts[bureau] || 0) + 1
    }
  }
  return counts
}

export function enforceRound1BureauCaps(
  selections: RoundSelectionInput[],
  maxPerBureau: number = ROUND_1_MAX_ITEMS_PER_BUREAU
): Round1CapResult {
  const counts = countSelectionsPerBureau(selections)
  const violations: Round1CapResult['violations'] = []
  for (const bureau of ['TUC', 'EXP', 'EQF'] as BureauCode[]) {
    const count = counts[bureau] || 0
    if (count > maxPerBureau) {
      violations.push({ bureau, count, max: maxPerBureau })
    }
  }
  if (!violations.length) return { ok: true, counts, violations }
  const detail = violations.map((v) => `${v.bureau}: ${v.count}/${v.max}`).join('; ')
  return {
    ok: false,
    counts,
    violations,
    message: `Round 1 allows at most ${maxPerBureau} items per bureau. Reduce selection (${detail}).`,
  }
}

export function accountLast4ForBureau(tl: Tradeline, bureau: BureauCode): string {
  const digits = accountDigits(accountForBureau(tl, bureau))
  if (digits.length >= 4) return digits.slice(-4)
  return digits
}

export function itemIdentityFromTradeline(tl: Tradeline, bureau: BureauCode): ItemIdentity | null {
  const matchKey = tradelineMatchKey(tl, bureau)
  if (!matchKey) return null
  return {
    matchKey,
    creditorName: (tl.creditor || '').trim() || 'Unknown',
    accountLast4: accountLast4ForBureau(tl, bureau),
    bureau,
    accountType: (tl.account_type || tl.item_category || '').trim(),
  }
}

export function expandTradelineSelections(tradelines: Tradeline[]): RoundSelectionInput[] {
  return tradelines
    .filter((t) => t.selected)
    .map((tradeline) => {
      const bureaus = (
        tradeline.dispute_bureaus?.length ? tradeline.dispute_bureaus : tradeline.bureaus
      ).filter((b): b is BureauCode => b === 'TUC' || b === 'EXP' || b === 'EQF')
      return { tradeline, bureaus }
    })
    .filter((s) => s.bureaus.length > 0)
}

export function disputeLettersZipDownloadNameForRound(
  consumerName: string | null | undefined,
  roundNumber: number
): string {
  const cleaned =
    (consumerName || 'Client')
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'Client'
  const round = Number.isFinite(roundNumber) && roundNumber >= 1 ? Math.floor(roundNumber) : 1
  return `${cleaned} round ${round} Letters.zip`
}

export function itemStatusLabel(status: DisputeItemStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'selected_for_round':
      return 'Selected'
    case 'disputed':
      return 'Disputed'
    case 'deleted':
      return 'Deleted'
    case 'verified':
      return 'Verified'
    case 'updated':
      return 'Updated'
    case 'no_response':
      return 'No response'
    case 'frivolous':
      return 'Frivolous'
    case 'withdrawn':
      return 'Withdrawn'
    default:
      return status
  }
}

export function roundStatusLabel(status: DisputeRoundStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'letters_ready':
      return 'Letters ready'
    case 'mailed':
      return 'Mailed'
    case 'awaiting_response':
      return 'Awaiting response'
    case 'closed':
      return 'Closed'
    default:
      return status
  }
}

/** Industry default: 30 calendar days after delivery (or mail date if delivery unknown). */
export const BUREAU_RESPONSE_DEADLINE_DAYS = 30

export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export function computeDeadlineAt(params: {
  deliveredAt?: string | null
  mailedAt?: string | null
  days?: number
}): string | null {
  const anchor = params.deliveredAt || params.mailedAt
  if (!anchor) return null
  return addCalendarDays(anchor, params.days ?? BUREAU_RESPONSE_DEADLINE_DAYS)
}

export function daysUntilDeadline(deadlineAt: string | null | undefined, now = new Date()): number | null {
  if (!deadlineAt) return null
  const end = new Date(deadlineAt)
  if (Number.isNaN(end.getTime())) return null
  return Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

/** Outcomes that should change letter type. In-progress statuses must not. */
export const FOLLOW_UP_OUTCOME_STATUSES: ReadonlySet<string> = new Set([
  'verified',
  'no_response',
  'updated',
  'frivolous',
])

export function isFollowUpOutcomeStatus(status: string | null | undefined): boolean {
  return FOLLOW_UP_OUTCOME_STATUSES.has(String(status || '').trim().toLowerCase())
}

export interface PlanSelectionWithStatus {
  id?: string
  selected?: boolean
  dispute_reason?: string
  item_status?: string
  preferred_letter_type?: string
  [key: string]: unknown
}

/**
 * Stamp bureau-reply outcomes onto plan selections.
 * Ignore pending / selected_for_round / disputed — those are set as soon as Round 1
 * is planned and must not switch the Python router onto the follow-up letter path.
 */
export function enrichPlanSelectionsWithItemStatus<T extends PlanSelectionWithStatus>(
  selections: T[],
  tradelines: Tradeline[],
  items: DisputeItemRow[]
): T[] {
  if (!selections.length || !items.length) return selections
  const byMatchKey = new Map(items.map((item) => [item.match_key, item]))
  const tlById = new Map(tradelines.map((t) => [t.id, t]))

  return selections.map((sel) => {
    if (!sel || typeof sel.id !== 'string') return sel
    if (isFollowUpOutcomeStatus(sel.item_status) || sel.preferred_letter_type) return sel
    const { item_status: _ignoredInProgress, ...rest } = sel
    const stripped = (sel.item_status ? rest : sel) as T
    const tl = tlById.get(sel.id)
    if (!tl) return stripped

    const bureaus = (
      tl.dispute_bureaus?.length ? tl.dispute_bureaus : tl.bureaus
    ).filter((b): b is BureauCode => b === 'TUC' || b === 'EXP' || b === 'EQF')

    for (const bureau of bureaus) {
      const identity = itemIdentityFromTradeline(tl, bureau)
      if (!identity) continue
      const item = byMatchKey.get(identity.matchKey)
      if (isFollowUpOutcomeStatus(item?.current_status)) {
        return { ...stripped, item_status: item?.current_status }
      }
    }
    return stripped
  })
}

export function suggestFollowUpLetterType(params: {
  itemStatus?: DisputeItemStatus | string | null
  preferred?: FollowUpLetterType | null
  isCollection?: boolean
  roundNumber?: number
}): FollowUpLetterType {
  if (params.preferred) return params.preferred
  const status = String(params.itemStatus || '')
    .trim()
    .toLowerCase()
  const round = Math.max(1, params.roundNumber || 1)

  if (status === 'verified') {
    return round >= 3 ? 'cfpb_complaint' : 'method_of_verification'
  }
  if (status === 'no_response') {
    return round >= 3 ? 'cfpb_complaint' : 'warning_intent'
  }
  if (status === 'updated') return 'reinvestigation'
  if (params.isCollection && round >= 2) return 'debt_validation'
  if (round >= 3 && status === 'disputed') return 'cfpb_complaint'
  return 'bureau_transunion'
}

export function followUpLetterTypeLabel(letterType: FollowUpLetterType | string): string {
  switch (letterType) {
    case 'method_of_verification':
      return 'Method of verification'
    case 'warning_intent':
      return 'Warning / intent'
    case 'reinvestigation':
      return 'Reinvestigation'
    case 'debt_validation':
      return 'Debt validation'
    case 'cfpb_complaint':
      return 'CFPB complaint'
    case 'furnisher':
      return 'Furnisher'
    case 'bureau_equifax':
      return 'Equifax bureau'
    case 'bureau_experian':
      return 'Experian bureau'
    case 'bureau_transunion':
      return 'TransUnion bureau'
    default:
      return letterType
  }
}

export function buildCfpbComplaintDraft(params: {
  consumerName: string
  items: Array<{
    creditorName: string
    accountLast4: string
    bureau: BureauCode
    currentStatus: DisputeItemStatus | string
    notes?: string | null
  }>
  roundSummary?: string
}): string {
  const name = (params.consumerName || 'Consumer').trim()
  const lines = params.items.map((item, i) => {
    const last4 = item.accountLast4 ? ` ···${item.accountLast4}` : ''
    const notes = item.notes?.trim() ? ` Notes: ${item.notes.trim()}` : ''
    return `${i + 1}. ${item.creditorName}${last4} (${item.bureau}) — status: ${item.currentStatus}.${notes}`
  })
  return [
    `# CFPB complaint draft — ${name}`,
    '',
    'I am submitting this complaint regarding inaccurate or unverifiable information on my consumer reports and inadequate reinvestigation by one or more consumer reporting agencies / furnishers.',
    '',
    params.roundSummary?.trim() ||
      'Prior dispute rounds were mailed. The items below remain unresolved after the statutory response window.',
    '',
    '## Accounts',
    ...lines,
    '',
    '## Requested outcome',
    '- Delete or correct each unverifiable or inaccurate tradeline.',
    '- Confirm that furnishers and CRAs have met FCRA duties.',
    '- Provide written confirmation of the agency response.',
    '',
    '_Draft only — submit via consumerfinance.gov with the consumer’s own credentials. Do not store passwords in this app._',
  ].join('\n')
}

/** Staff CRM-style checklist templates for dispute ops (Phase 7). */
export const DISPUTE_OPS_TASK_TEMPLATES = [
  {
    id: 'round1-mail',
    title: 'Mail Round 1 packet',
    steps: [
      'Print bureau + furnisher letters',
      'Attach photo ID and proof of address',
      'Mail certified / priority and log tracking',
      'Set deadline (delivery + 30 days) and mark awaiting response',
    ],
  },
  {
    id: 'round2-mov',
    title: 'Build Round 2 follow-ups',
    steps: [
      'Log bureau outcomes (deleted / verified / updated / no response)',
      'Route verified → MOV, no response → warning, collections → debt validation',
      'Keep one primary item per bureau letter',
      'Mail and refresh deadline',
    ],
  },
  {
    id: 'cfpb-escalation',
    title: 'CFPB escalation',
    steps: [
      'Confirm Round 2+ exhausted without deletion',
      'Draft complaint from unresolved items',
      'Client submits on consumerfinance.gov (no staff login)',
      'Track agency response and update item statuses',
    ],
  },
  {
    id: 'client-release',
    title: 'Release packet to client portal',
    steps: [
      'Mark round letters ready / mailed',
      'Release round to client portal',
      'Client downloads letters and uploads bureau replies',
      'Staff reviews uploads and advances next round',
    ],
  },
] as const
