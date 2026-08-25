import { accountForBureau, tradelineCoversBureau } from '@/lib/dispute-letters/bureau-coverage'
import type {
  BureauCode,
  FieldChangeDirection,
  ParsedReport,
  Tradeline,
  TradelineChange,
  TradelineFieldChange,
  TradelineProgressDiff,
} from '@/lib/dispute-letters/types'

const DIFF_FIELDS: { field: keyof Tradeline; label: string; lowerIsBetter: boolean }[] = [
  { field: 'balance', label: 'Balance', lowerIsBetter: true },
  { field: 'past_due', label: 'Past due', lowerIsBetter: true },
  { field: 'credit_limit', label: 'Credit limit', lowerIsBetter: false },
  { field: 'high_credit', label: 'High credit', lowerIsBetter: false },
  { field: 'status', label: 'Status', lowerIsBetter: false },
  { field: 'remarks', label: 'Remarks', lowerIsBetter: false },
]

function normalizeAccount(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function normalizeCreditor(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function maskAccount(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 4) return `···${digits.slice(-4)}`
  const cleaned = raw.trim()
  if (!cleaned) return '—'
  return cleaned.length > 8 ? `···${cleaned.slice(-4)}` : cleaned
}

export function tradelineMatchKey(tl: Tradeline, bureau: BureauCode): string | null {
  const acct = normalizeAccount(accountForBureau(tl, bureau))
  if (acct.length >= 4) return `acct:${bureau}:${acct}`
  const creditor = normalizeCreditor(tl.creditor || '')
  if (!creditor) return null
  const type = normalizeCreditor(tl.account_type || '')
  const last4 = acct.slice(-4) || 'x'
  return `fb:${bureau}:${creditor}:${type}:${last4}`
}

function toChange(tl: Tradeline, bureau: BureauCode): TradelineChange {
  return {
    creditor: tl.creditor || 'Unknown',
    accountMask: maskAccount(accountForBureau(tl, bureau)),
    status: tl.status || undefined,
    balance: tl.balance || undefined,
    category: tl.item_category || (tl.is_collection ? 'collection' : undefined),
  }
}

function fieldDirection(
  field: string,
  from: string,
  to: string,
  lowerIsBetter: boolean
): FieldChangeDirection {
  if (field === 'status' || field === 'remarks') {
    const fromL = from.toLowerCase()
    const toL = to.toLowerCase()
    const worsened =
      /collection|charge.?off|delinquent|past due/.test(toL) &&
      !/collection|charge.?off|delinquent|past due/.test(fromL)
    const improved =
      /paid|closed|current|good standing/.test(toL) &&
      /collection|charge.?off|delinquent|past due/.test(fromL)
    if (improved) return 'improved'
    if (worsened) return 'worsened'
    return 'neutral'
  }
  const a = parseMoney(from)
  const b = parseMoney(to)
  if (a == null || b == null || a === b) return 'neutral'
  if (lowerIsBetter) return b < a ? 'improved' : 'worsened'
  return b > a ? 'improved' : 'worsened'
}

function normalizeFieldValue(value: string | undefined | null): string {
  return (value || '').trim()
}

function diffMatchedFields(prev: Tradeline, curr: Tradeline): TradelineFieldChange['fields'] {
  const fields: TradelineFieldChange['fields'] = []
  for (const spec of DIFF_FIELDS) {
    const from = normalizeFieldValue(prev[spec.field] as string | undefined)
    const to = normalizeFieldValue(curr[spec.field] as string | undefined)
    if (from === to) continue
    if (!from && !to) continue
    fields.push({
      field: String(spec.field),
      label: spec.label,
      from: from || '—',
      to: to || '—',
      direction: fieldDirection(String(spec.field), from, to, spec.lowerIsBetter),
    })
  }
  return fields
}

function bureauTradelines(report: ParsedReport | null | undefined, bureau: BureauCode): Tradeline[] {
  return (report?.tradelines || []).filter((tl) => tradelineCoversBureau(tl, bureau))
}

export function diffTradelinesForBureau(
  previousReport: ParsedReport | null | undefined,
  currentReport: ParsedReport | null | undefined,
  bureau: BureauCode
): TradelineProgressDiff {
  const prevList = bureauTradelines(previousReport, bureau)
  const currList = bureauTradelines(currentReport, bureau)

  const prevMap = new Map<string, Tradeline>()
  const currMap = new Map<string, Tradeline>()
  let keyedPrev = 0
  let keyedCurr = 0

  for (const tl of prevList) {
    const key = tradelineMatchKey(tl, bureau)
    if (!key) continue
    keyedPrev += 1
    if (!prevMap.has(key)) prevMap.set(key, tl)
  }
  for (const tl of currList) {
    const key = tradelineMatchKey(tl, bureau)
    if (!key) continue
    keyedCurr += 1
    if (!currMap.has(key)) currMap.set(key, tl)
  }

  const removed: TradelineChange[] = []
  const added: TradelineChange[] = []
  const changed: TradelineFieldChange[] = []

  for (const [key, tl] of prevMap) {
    if (!currMap.has(key)) removed.push(toChange(tl, bureau))
  }
  for (const [key, tl] of currMap) {
    if (!prevMap.has(key)) added.push(toChange(tl, bureau))
  }
  for (const [key, prev] of prevMap) {
    const curr = currMap.get(key)
    if (!curr) continue
    const fields = diffMatchedFields(prev, curr)
    if (fields.length > 0) {
      changed.push({
        creditor: curr.creditor || prev.creditor || 'Unknown',
        accountMask: maskAccount(accountForBureau(curr, bureau) || accountForBureau(prev, bureau)),
        fields,
      })
    }
  }

  const total = Math.max(prevList.length, currList.length, 1)
  const keyedRatio = Math.max(keyedPrev, keyedCurr) / total
  let matchConfidence: TradelineProgressDiff['matchConfidence'] = 'low'
  if (keyedRatio >= 0.6) matchConfidence = 'high'
  else if (keyedRatio >= 0.3) matchConfidence = 'medium'

  return { removed, added, changed, matchConfidence }
}

export function emptyTradelineProgressDiff(): TradelineProgressDiff {
  return { removed: [], added: [], changed: [], matchConfidence: 'low' }
}
