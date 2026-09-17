import { filenameBureauHint, getSessionBureauCoverage, sessionReportDate } from '@/lib/dispute-letters/bureau-coverage'
import {
  allIdentitiesFromTradelines,
  pendingIdentitiesFromTradelines,
  type ItemIdentity,
} from '@/lib/dispute-letters/dispute-lifecycle'
import { applyRecommendedSelection } from '@/lib/dispute-letters/dispute-selection'
import { accountDigits } from '@/lib/dispute-letters/tradeline-progress'
import type { BureauCode, DisputeSessionListItem, Tradeline } from '@/lib/dispute-letters/types'

const BUREAU_CODES: BureauCode[] = ['TUC', 'EXP', 'EQF']
const TRI_MERGE_NAME_RE = /3[\s_-]*bureau|tri[\s_-]*merge|all[\s_-]*three|credit[\s_-]*hero/i
export const DEFAULT_ROUND1_REPORT_DATE = '2026-07-24'

export type HistoricalPlanItem = {
  tradeline_id?: string
  creditor?: string
  account_number?: string
  bureau?: string
}

export type HistoricalPlan = {
  id?: string
  items?: HistoricalPlanItem[]
}

export function normalizeReportDate(value: string | null | undefined): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const us = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  }
  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed)) return raw.slice(0, 10)
  return new Date(parsed).toISOString().slice(0, 10)
}

export function isTriMergeSession(session: DisputeSessionListItem): boolean {
  if (TRI_MERGE_NAME_RE.test(session.file_name || '')) return true
  return getSessionBureauCoverage(session).coverage === 'tri_merge'
}

export function readySessionsWithTradelines(sessions: DisputeSessionListItem[]): DisputeSessionListItem[] {
  return sessions.filter(
    (session) => session.status === 'ready' && (session.report_json?.tradelines || []).length > 0
  )
}

export function pickHistoricalRound1Session(
  sessions: DisputeSessionListItem[],
  preferredReportDate: string = DEFAULT_ROUND1_REPORT_DATE
): DisputeSessionListItem | null {
  const ready = readySessionsWithTradelines(sessions)
  const want = normalizeReportDate(preferredReportDate)
  const triMerge = ready.filter(isTriMergeSession)
  const dated = triMerge.find((session) => normalizeReportDate(sessionReportDate(session)) === want)
  if (dated) return dated
  const monthDay = want.slice(5)
  const datedMonthDay = monthDay
    ? triMerge.find((session) => normalizeReportDate(sessionReportDate(session)).slice(5) === monthDay)
    : undefined
  if (datedMonthDay) return datedMonthDay
  const sorted = [...triMerge].sort((a, b) =>
    normalizeReportDate(sessionReportDate(a)).localeCompare(normalizeReportDate(sessionReportDate(b)))
  )
  return sorted[0] || null
}

export function followUpSessionsAfterRound1(
  sessions: DisputeSessionListItem[],
  round1: DisputeSessionListItem
): DisputeSessionListItem[] {
  const round1Date = normalizeReportDate(sessionReportDate(round1))
  return readySessionsWithTradelines(sessions)
    .filter((session) => session.id !== round1.id)
    .filter((session) => normalizeReportDate(sessionReportDate(session)) > round1Date)
    .sort((a, b) => normalizeReportDate(sessionReportDate(a)).localeCompare(normalizeReportDate(sessionReportDate(b))))
}

function sessionCoversBureau(session: DisputeSessionListItem, bureau: BureauCode): boolean {
  const fromName = filenameBureauHint(session.file_name)
  if (fromName.length === 1) return fromName[0] === bureau
  return getSessionBureauCoverage(session).bureaus.includes(bureau)
}

function latestSessionForBureau(
  sessions: DisputeSessionListItem[],
  bureau: BureauCode
): DisputeSessionListItem | undefined {
  return [...sessions]
    .filter((session) => sessionCoversBureau(session, bureau))
    .sort((a, b) => {
      const dateCmp = normalizeReportDate(sessionReportDate(b)).localeCompare(
        normalizeReportDate(sessionReportDate(a))
      )
      if (dateCmp !== 0) return dateCmp
      return b.created_at.localeCompare(a.created_at)
    })[0]
}

/** Latest on-file / dispute-candidate keys, using the newest report that covers each bureau. */
export function comparisonKeysFromSessions(sessions: DisputeSessionListItem[]): {
  matchKeys: Set<string>
  candidateKeys: Set<string>
} {
  const ready = readySessionsWithTradelines(sessions)
  const matchKeys = new Set<string>()
  const candidateKeys = new Set<string>()
  for (const bureau of BUREAU_CODES) {
    const session = latestSessionForBureau(ready, bureau)
    const tradelines = session?.report_json?.tradelines || []
    if (!tradelines.length) continue
    for (const identity of allIdentitiesFromTradelines(tradelines)) {
      if (identity.bureau === bureau) matchKeys.add(identity.matchKey)
    }
    for (const identity of pendingIdentitiesFromTradelines(tradelines)) {
      if (identity.bureau === bureau) candidateKeys.add(identity.matchKey)
    }
  }
  return { matchKeys, candidateKeys }
}

export function latestPendingIdentitiesFromSessions(sessions: DisputeSessionListItem[]): ItemIdentity[] {
  const ready = readySessionsWithTradelines(sessions)
  const out: ItemIdentity[] = []
  const seen = new Set<string>()
  for (const bureau of BUREAU_CODES) {
    const session = latestSessionForBureau(ready, bureau)
    const tradelines = session?.report_json?.tradelines || []
    for (const identity of pendingIdentitiesFromTradelines(tradelines)) {
      if (identity.bureau !== bureau || seen.has(identity.matchKey)) continue
      seen.add(identity.matchKey)
      out.push(identity)
    }
  }
  return out
}

function tradelineLast4s(tradeline: Tradeline): string[] {
  return [tradeline.account_tu, tradeline.account_exp, tradeline.account_eqf]
    .map((value) => {
      const digits = accountDigits(value)
      return digits.length >= 4 ? digits.slice(-4) : digits
    })
    .filter(Boolean)
}

export function planItemMatchesTradeline(tradeline: Tradeline, item: HistoricalPlanItem): boolean {
  if (item.tradeline_id && item.tradeline_id === tradeline.id) return true
  const creditor = (item.creditor || '').trim().toLowerCase()
  if (!creditor || creditor !== (tradeline.creditor || '').trim().toLowerCase()) return false
  const last4 = accountDigits(item.account_number || '')
  if (last4.length >= 4) {
    const needle = last4.slice(-4)
    if (!tradelineLast4s(tradeline).includes(needle)) return false
  }
  const bureau = String(item.bureau || '')
    .split(/[,\s]+/)
    .map((part) => (part.trim().toUpperCase() === 'TU' ? 'TUC' : part.trim().toUpperCase()))
    .filter((part): part is BureauCode => part === 'TUC' || part === 'EXP' || part === 'EQF')
  if (bureau.length && !bureau.some((code) => (tradeline.bureaus || []).includes(code))) return false
  return true
}

/** Use stored letter-plan accounts when present; otherwise the recommended Round 1 set. */
export function selectTradelinesForHistoricalRound1(
  tradelines: Tradeline[],
  plans: HistoricalPlan[]
): Tradeline[] {
  const planItems = plans.flatMap((plan) => plan.items || [])
  if (planItems.length) {
    const selected = tradelines.map((tradeline) => ({
      ...tradeline,
      selected: planItems.some((item) => planItemMatchesTradeline(tradeline, item)),
      dispute_reason:
        tradeline.dispute_reason || tradeline.suggested_dispute_reason || tradeline.dispute_reason,
    }))
    if (selected.some((tradeline) => tradeline.selected)) return selected
  }
  return applyRecommendedSelection(tradelines.map((tradeline) => ({ ...tradeline, selected: false })))
}

export function followUpResponseNote(session: DisputeSessionListItem): string {
  const fromName = filenameBureauHint(session.file_name)
  const coverage =
    fromName.length === 1
      ? { bureaus: fromName, coverage: 'single' as const }
      : getSessionBureauCoverage(session)
  const bureau =
    coverage.bureaus.length === 1
      ? coverage.bureaus[0] === 'TUC'
        ? 'TransUnion'
        : coverage.bureaus[0] === 'EXP'
          ? 'Experian'
          : 'Equifax'
      : coverage.coverage === 'tri_merge'
        ? '3-bureau'
        : 'bureau'
  const date = normalizeReportDate(sessionReportDate(session))
  return `Follow-up ${bureau} report used as Round 1 response (${date || 'undated'}).`
}
