import { accountForBureau } from '@/lib/dispute-letters/bureau-coverage'
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

export interface DisputeRoundRow {
  id: string
  case_id: string
  round_number: number
  status: DisputeRoundStatus
  session_id: string | null
  notes: string | null
  started_at: string
  mailed_at: string | null
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

/** Statuses that still need work in a later round. */
export const NEEDS_NEXT_ROUND_STATUSES: DisputeItemStatus[] = [
  'pending',
  'no_response',
  'verified',
  'updated',
  'selected_for_round',
  'disputed',
]

export function isRoundClosedForNext(status: DisputeRoundStatus): boolean {
  return status === 'mailed' || status === 'closed' || status === 'awaiting_response'
}

export function nextRoundNumber(rounds: { round_number: number }[]): number {
  if (!rounds.length) return 1
  return Math.max(...rounds.map((r) => r.round_number)) + 1
}

export function pendingQueueFromItems(items: DisputeItemRow[]): DisputeItemRow[] {
  return items
    .filter((i) => NEEDS_NEXT_ROUND_STATUSES.includes(i.current_status))
    .sort((a, b) => {
      const bureauCmp = a.bureau.localeCompare(b.bureau)
      if (bureauCmp !== 0) return bureauCmp
      return a.creditor_name.localeCompare(b.creditor_name)
    })
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
