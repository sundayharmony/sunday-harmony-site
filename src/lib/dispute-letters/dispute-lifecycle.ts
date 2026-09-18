import { accountForBureau, isNegativeTradeline, tradelineCoversBureau } from '@/lib/dispute-letters/bureau-coverage'
import { isInquiryTradeline } from '@/lib/dispute-letters/dispute-reasons'
import { isRecommendedDispute } from '@/lib/dispute-letters/dispute-selection'
import { accountDigits, tradelineMatchKey } from '@/lib/dispute-letters/tradeline-progress'
import type { BureauCode, Tradeline } from '@/lib/dispute-letters/types'

/** Soft warning only — selection is not blocked. Bureau letters split at MAX_ITEMS_PER_LETTER. */
export const ROUND_1_MAX_ITEMS_PER_BUREAU = 50

/** Max accounts in a single bureau (or furnisher) letter; extra items create additional letters. */
export const MAX_ITEMS_PER_LETTER = 7

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
  sent_at?: string | null
  status_history?: DisputeStatusEvent[]
  created_at: string
  updated_at: string
}

export type DisputeWorkflowStage =
  | 'identified'
  | 'selected'
  | 'letter_generated'
  | 'sent'
  | 'still_appears'
  | 'resolved'
  | 'withdrawn'

export interface DisputeStatusEvent {
  at: string
  stage: DisputeWorkflowStage | string
  roundNumber?: number | null
  detail?: string | null
}

export interface DisputeRoundLetter {
  id: string
  session_id: string
  plan_id: string
  title: string
  sent_at: string | null
  created_at?: string
  package_id?: string | null
}

export interface LetterPackageRow {
  id: string
  case_id: string
  round_id: string
  session_id: string | null
  version: number
  is_active: boolean
  letter_count: number
  downloaded_at: string | null
  download_count: number
  sent_confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface LetterPackageMember {
  package_id: string
  item_id: string
  letter_id: string | null
  letter_type: string
  sent_at: string | null
  creditor_name: string
  bureau: BureauCode
  account_last4: string
  letter_title: string | null
}

export interface RoundWorkflowView {
  label: string
  complete: boolean
  awaiting: number
  downloaded: boolean
  generated: number
  sent: number
  selected: number
}

export interface LetterPackageSnapshot {
  package: LetterPackageRow
  members: LetterPackageMember[]
  generatedCount: number
  sentCount: number
  pendingCount: number
  downloaded: boolean
  allSent: boolean
  workflow: RoundWorkflowView
}

export interface DisputeLifecycleSnapshot {
  case: DisputeCaseRow | null
  rounds: DisputeRoundRow[]
  items: DisputeItemRow[]
  identifiedQueue: DisputeItemRow[]
  selectedQueue: DisputeItemRow[]
  letterGeneratedQueue: DisputeItemRow[]
  sentQueue: DisputeItemRow[]
  nextRoundQueue: DisputeItemRow[]
  /** @deprecated Use identifiedQueue + selectedQueue */
  notYetDisputed: DisputeItemRow[]
  /** Next-round remaining items (still on file after a sent round, or bureau outcomes). */
  pendingQueue: DisputeItemRow[]
  activeRound: DisputeRoundRow | null
  letters: DisputeRoundLetter[]
  packages: LetterPackageSnapshot[]
  activePackage: LetterPackageSnapshot | null
  roundWorkflow: RoundWorkflowView
  roundSendProgress: { selected: number; sent: number; complete: boolean }
  hasCompletedRound: boolean
  /** True when a report exists that is not the completed round's source or a recorded response. */
  hasUpdatedReportForNextRound: boolean
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

/** Identified on the report, not yet chosen for the current round. */
export const IDENTIFIED_STATUSES: DisputeItemStatus[] = ['pending']

/** Chosen for the current round; letters may or may not exist yet. */
export const SELECTED_STATUSES: DisputeItemStatus[] = ['selected_for_round']

/** Bureau-reply outcomes that still need a later round. */
export const NEEDS_NEXT_ROUND_STATUSES: DisputeItemStatus[] = [
  'no_response',
  'verified',
  'updated',
]

/** @deprecated Use IDENTIFIED_STATUSES + SELECTED_STATUSES */
export const NOT_YET_DISPUTED_STATUSES: DisputeItemStatus[] = [
  'pending',
  'selected_for_round',
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

export function isRoundFullySent(params: {
  round: DisputeRoundRow | null | undefined
  roundItemIds: string[]
  items: DisputeItemRow[]
}): boolean {
  if (!params.round || !params.roundItemIds.length) return false
  const byId = new Map(params.items.map((item) => [item.id, item]))
  return params.roundItemIds.every((id) => Boolean(byId.get(id)?.sent_at))
}

/** Short staff-facing package id, e.g. PKG-A1B2C3D4. */
export function letterPackageDisplayCode(id: string | null | undefined): string {
  const compact = String(id || '')
    .replace(/-/g, '')
    .slice(-8)
    .toUpperCase()
  return compact ? `PKG-${compact}` : 'PKG-UNKNOWN'
}

export function letterIdsSignature(ids: string[]): string {
  return [...ids].filter(Boolean).sort().join(',')
}

export function shouldReuseLetterPackage(existingLetterIds: string[], newLetterIds: string[]): boolean {
  if (!existingLetterIds.length || !newLetterIds.length) return false
  return letterIdsSignature(existingLetterIds) === letterIdsSignature(newLetterIds)
}

export function roundWorkflowView(params: {
  selectedCount: number
  generatedCount: number
  downloaded: boolean
  sentCount: number
}): RoundWorkflowView {
  const selected = Math.max(0, params.selectedCount)
  const generated = Math.max(0, params.generatedCount)
  const sent = Math.max(0, params.sentCount)
  const awaiting = Math.max(0, selected - sent)
  const complete = selected > 0 && sent >= selected
  if (complete) {
    return {
      label: 'Complete',
      complete: true,
      awaiting: 0,
      downloaded: params.downloaded,
      generated,
      sent,
      selected,
    }
  }
  if (generated > 0 && params.downloaded && awaiting > 0) {
    if (sent === 0) {
      return {
        label: 'Ready to Send',
        complete: false,
        awaiting,
        downloaded: true,
        generated,
        sent,
        selected,
      }
    }
    return {
      label: `Awaiting ${awaiting} Letter${awaiting === 1 ? '' : 's'}`,
      complete: false,
      awaiting,
      downloaded: true,
      generated,
      sent,
      selected,
    }
  }
  if (generated > 0) {
    return {
      label: 'Letters generated',
      complete: false,
      awaiting,
      downloaded: params.downloaded,
      generated,
      sent,
      selected,
    }
  }
  if (selected > 0) {
    return {
      label: 'Selected',
      complete: false,
      awaiting,
      downloaded: false,
      generated,
      sent,
      selected,
    }
  }
  return {
    label: 'Draft',
    complete: false,
    awaiting: 0,
    downloaded: false,
    generated: 0,
    sent: 0,
    selected: 0,
  }
}

export function buildLetterPackageSnapshot(params: {
  package: LetterPackageRow
  members: LetterPackageMember[]
  selectedCount?: number
}): LetterPackageSnapshot {
  const sentCount = params.members.filter((member) => Boolean(member.sent_at)).length
  const generatedCount = params.package.letter_count || new Set(params.members.map((m) => m.letter_id).filter(Boolean)).size
  const selectedCount = params.selectedCount ?? params.members.length
  const downloaded = Boolean(params.package.downloaded_at) || params.package.download_count > 0
  const workflow = roundWorkflowView({
    selectedCount,
    generatedCount,
    downloaded,
    sentCount,
  })
  return {
    package: params.package,
    members: params.members,
    generatedCount,
    sentCount,
    pendingCount: Math.max(0, selectedCount - sentCount),
    downloaded,
    allSent: selectedCount > 0 && sentCount >= selectedCount,
    workflow,
  }
}

export function itemWorkflowStage(
  item: DisputeItemRow,
  activeRound: DisputeRoundRow | null = null
): DisputeWorkflowStage {
  if (item.current_status === 'deleted') return 'resolved'
  if (item.current_status === 'withdrawn' || item.current_status === 'frivolous') return 'withdrawn'
  if (
    item.current_status === 'verified' ||
    item.current_status === 'updated' ||
    item.current_status === 'no_response'
  ) {
    return 'still_appears'
  }
  // Re-selected for a later round takes precedence over a prior sent_at.
  if (item.current_status === 'selected_for_round') {
    if (
      activeRound &&
      (activeRound.status === 'letters_ready' ||
        activeRound.status === 'mailed' ||
        activeRound.status === 'awaiting_response') &&
      item.last_round_number === activeRound.round_number
    ) {
      return 'letter_generated'
    }
    return 'selected'
  }
  if (item.sent_at) return 'sent'
  if (item.current_status === 'disputed') {
    // Legacy rows stamped disputed at plan time — treat as letter generated until Sent.
    return 'letter_generated'
  }
  return 'identified'
}

export function splitWorkflowQueues(
  items: DisputeItemRow[],
  activeRound: DisputeRoundRow | null = null,
  completedRoundNumbers: number[] = []
): {
  identified: DisputeItemRow[]
  selected: DisputeItemRow[]
  letterGenerated: DisputeItemRow[]
  sent: DisputeItemRow[]
  nextRound: DisputeItemRow[]
  resolved: DisputeItemRow[]
} {
  const identified: DisputeItemRow[] = []
  const selected: DisputeItemRow[] = []
  const letterGenerated: DisputeItemRow[] = []
  const sent: DisputeItemRow[] = []
  const nextRound: DisputeItemRow[] = []
  const resolved: DisputeItemRow[] = []
  const completed = new Set(completedRoundNumbers)

  for (const item of items) {
    const stage = itemWorkflowStage(item, activeRound)
    if (stage === 'resolved' || stage === 'withdrawn') {
      resolved.push(item)
      continue
    }
    if (stage === 'still_appears') {
      nextRound.push(item)
      continue
    }
    if (stage === 'sent') {
      sent.push(item)
      const last = item.last_round_number
      if (last && completed.has(last)) nextRound.push(item)
      continue
    }
    if (stage === 'letter_generated') {
      letterGenerated.push(item)
      continue
    }
    if (stage === 'selected') {
      selected.push(item)
      continue
    }
    identified.push(item)
    // After a completed round, newly identified / never-selected items feed Next Round.
    if (completed.size > 0) nextRound.push(item)
  }

  return {
    identified: sortQueueItems(identified),
    selected: sortQueueItems(selected),
    letterGenerated: sortQueueItems(letterGenerated),
    sent: sortQueueItems(sent),
    nextRound: sortQueueItems(nextRound),
    resolved: sortQueueItems(resolved),
  }
}

export type NextRoundReportSession = {
  id: string
  status: string
  file_name: string
  storage_path: string
  report_json?: { tradelines?: unknown[] } | null
}

function responseFileKey(storagePath: string, fileName: string): string {
  return `${storagePath}::${fileName}`.toLowerCase()
}

/**
 * Follow-up PDFs already used as the mailed round's source or recorded responses
 * are not "new updated reports" for the next round.
 */
export function hasUpdatedReportForNextRound(params: {
  sessions: NextRoundReportSession[]
  completedRounds: { session_id: string | null }[]
  responses: { file_name: string; storage_path: string }[]
}): boolean {
  if (!params.completedRounds.length) return false
  const usedSessionIds = new Set(
    params.completedRounds.map((round) => round.session_id).filter((id): id is string => Boolean(id))
  )
  const usedFiles = new Set(
    params.responses.flatMap((row) => [
      responseFileKey(row.storage_path, row.file_name),
      row.file_name.trim().toLowerCase(),
    ])
  )
  return params.sessions.some((session) => {
    if (session.status !== 'ready') return false
    if (!(session.report_json?.tradelines || []).length) return false
    if (usedSessionIds.has(session.id)) return false
    const fileName = session.file_name.trim().toLowerCase()
    if (usedFiles.has(fileName) || usedFiles.has(responseFileKey(session.storage_path, session.file_name))) {
      return false
    }
    return true
  })
}

export function appendStatusEvent(
  history: DisputeStatusEvent[] | null | undefined,
  event: Omit<DisputeStatusEvent, 'at'> & { at?: string }
): DisputeStatusEvent[] {
  if (!shouldAppendStatusEvent(history, event)) return history || []
  return [...(history || []), { at: event.at || new Date().toISOString(), ...event }]
}

/** Skip back-to-back identical workflow events (e.g. re-syncing round selections). */
export function shouldAppendStatusEvent(
  history: DisputeStatusEvent[] | null | undefined,
  event: Omit<DisputeStatusEvent, 'at'> & { at?: string }
): boolean {
  const rows = history || []
  const last = rows[rows.length - 1]
  if (!last) return true
  return !(
    last.stage === event.stage &&
    (last.roundNumber ?? null) === (event.roundNumber ?? null) &&
    (last.detail || '').trim() === (event.detail || '').trim()
  )
}

export function nextRoundNumber(rounds: { round_number: number }[]): number {
  if (!rounds.length) return 1
  return Math.max(...rounds.map((r) => r.round_number)) + 1
}

export function notYetDisputedFromItems(items: DisputeItemRow[]): DisputeItemRow[] {
  const queues = splitWorkflowQueues(items)
  return sortQueueItems([...queues.identified, ...queues.selected])
}

export function pendingQueueFromItems(items: DisputeItemRow[]): DisputeItemRow[] {
  return splitWorkflowQueues(items).nextRound
}

/** Negatives, inquiries, and recommended disputes should appear in the item queue. */
export function isDisputeCandidateTradeline(tl: Tradeline): boolean {
  return isNegativeTradeline(tl) || isInquiryTradeline(tl) || isRecommendedDispute(tl)
}

/**
 * Expand remaining dispute candidates into per-bureau identities.
 * Selected-for-round rows are created separately; this covers accounts not yet in a letter.
 */
export function allIdentitiesFromTradelines(tradelines: Tradeline[]): ItemIdentity[] {
  const out: ItemIdentity[] = []
  const seen = new Set<string>()
  for (const tl of tradelines) {
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

/** Split a bureau/furnisher item list so each letter stays at MAX_ITEMS_PER_LETTER. */
export function chunkItems<T>(items: T[], size: number = MAX_ITEMS_PER_LETTER): T[][] {
  const max = size < 1 ? 1 : size
  if (!items.length) return []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += max) {
    chunks.push(items.slice(i, i + max))
  }
  return chunks
}

export function letterChunkCount(itemCount: number, size: number = MAX_ITEMS_PER_LETTER): number {
  if (itemCount <= 0) return 0
  return Math.ceil(itemCount / (size < 1 ? 1 : size))
}

export interface ComparisonItemUpdate {
  id: string
  nextStatus?: DisputeItemStatus
  event: Omit<DisputeStatusEvent, 'at'>
}

/**
 * Compare durable dispute items against the latest report.
 * Removed → resolved. Still on file after a send → still appears.
 * Corrected (on file but no longer a candidate) → updated.
 * Reappeared after deletion → identified.
 */
export function comparisonUpdatesForItems(params: {
  items: DisputeItemRow[]
  latestMatchKeys: Set<string>
  latestCandidateKeys: Set<string>
}): ComparisonItemUpdate[] {
  const updates: ComparisonItemUpdate[] = []
  for (const item of params.items) {
    const onFile = params.latestMatchKeys.has(item.match_key)
    const candidate = params.latestCandidateKeys.has(item.match_key)
    const wasDisputed = Boolean(item.sent_at) ||
      item.current_status === 'verified' ||
      item.current_status === 'updated' ||
      item.current_status === 'no_response'

    if (!onFile) {
      if (item.current_status === 'deleted' || item.current_status === 'withdrawn') continue
      if (!wasDisputed) continue
      updates.push({
        id: item.id,
        nextStatus: 'deleted',
        event: {
          stage: 'resolved',
          roundNumber: item.last_round_number,
          detail: 'Removed from latest credit report',
        },
      })
      continue
    }

    if (item.current_status === 'deleted' && candidate) {
      updates.push({
        id: item.id,
        nextStatus: 'pending',
        event: {
          stage: 'identified',
          roundNumber: item.last_round_number,
          detail: 'Reappeared on latest credit report',
        },
      })
      continue
    }

    if (!wasDisputed) continue

    if (!candidate) {
      if (item.current_status === 'updated' || item.current_status === 'deleted') continue
      updates.push({
        id: item.id,
        nextStatus: 'updated',
        event: {
          stage: 'still_appears',
          roundNumber: item.last_round_number,
          detail: 'Still on file but no longer a dispute candidate (corrected)',
        },
      })
      continue
    }

    const history = item.status_history || []
    const last = history[history.length - 1]
    if (last?.stage === 'still_appears' && last.detail?.includes('Still appears')) continue
    updates.push({
      id: item.id,
      event: {
        stage: 'still_appears',
        roundNumber: item.last_round_number,
        detail: 'Still appears on latest credit report',
      },
    })
  }
  return updates
}

function formatStatusHistoryDate(at: string | undefined): string {
  if (!at) return ''
  return new Date(at).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

function statusHistoryAction(event: DisputeStatusEvent): string {
  const detail = (event.detail || '').trim()
  const stage =
    event.stage === 'identified' ||
    event.stage === 'selected' ||
    event.stage === 'letter_generated' ||
    event.stage === 'sent' ||
    event.stage === 'still_appears' ||
    event.stage === 'resolved' ||
    event.stage === 'withdrawn'
      ? workflowStageLabel(event.stage)
      : event.stage

  if (!detail) return stage
  if (!stage) return detail

  const detailLower = detail.toLowerCase()
  const stageLower = stage.toLowerCase()
  if (detailLower === stageLower || detailLower.includes(stageLower)) return detail
  return `${stage}: ${detail}`
}

export function formatStatusHistory(events: DisputeStatusEvent[] | null | undefined): string[] {
  const lines: string[] = []
  for (const event of events || []) {
    const date = formatStatusHistoryDate(event.at)
    const round = event.roundNumber ? `Round ${event.roundNumber}` : ''
    const line = [date, round, statusHistoryAction(event)].filter(Boolean).join(' · ')
    if (!line) continue
    if (lines.length > 0 && lines[lines.length - 1] === line) continue
    lines.push(line)
  }
  return lines
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

export function itemStatusLabel(status: DisputeItemStatus, sentAt?: string | null): string {
  switch (status) {
    case 'pending':
      return 'Identified'
    case 'selected_for_round':
      return 'Selected for round'
    case 'disputed':
      return sentAt ? 'Sent' : 'Letter generated'
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

export function workflowStageLabel(stage: DisputeWorkflowStage): string {
  switch (stage) {
    case 'identified':
      return 'Identified'
    case 'selected':
      return 'Selected for round'
    case 'letter_generated':
      return 'Letter generated'
    case 'sent':
      return 'Sent'
    case 'still_appears':
      return 'Still appears'
    case 'resolved':
      return 'Resolved / removed'
    case 'withdrawn':
      return 'Withdrawn'
    default:
      return stage
  }
}

export function roundStatusLabel(status: DisputeRoundStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'letters_ready':
      return 'Letters generated'
    case 'mailed':
      return 'Complete'
    case 'awaiting_response':
      return 'Complete'
    case 'closed':
      return 'Closed'
    default:
      return status
  }
}

/** Bureau-reply outcomes only — not generate/sent workflow statuses. */
export const BUREAU_OUTCOME_STATUSES: DisputeItemStatus[] = [
  'deleted',
  'verified',
  'updated',
  'no_response',
  'frivolous',
  'withdrawn',
]

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
    return `${i + 1}. ${item.creditorName}${last4} (${item.bureau}), status: ${item.currentStatus}.${notes}`
  })
  return [
    `# CFPB complaint draft: ${name}`,
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
    '_Draft only. Submit via consumerfinance.gov with the consumer’s own credentials. Do not store passwords in this app._',
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
