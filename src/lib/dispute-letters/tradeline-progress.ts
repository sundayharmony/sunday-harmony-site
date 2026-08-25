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

/** Digits only — mask chars (* X #) are ignored so 47****** and 47XXXXXX share identity. */
export function accountDigits(value: string): string {
  return (value || '')
    .replace(/[*Xx#•·_]/g, '')
    .replace(/\D/g, '')
}

function normalizeCreditor(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeType(value: string): string {
  const t = normalizeCreditor(value)
  if (!t) return ''
  if (/inquir/.test(t)) return 'inquiry'
  if (/collect/.test(t)) return 'collection'
  if (/mortgage|real estate/.test(t)) return 'mortgage'
  if (/auto|vehicle|install/.test(t)) return 'installment'
  if (/revolving|credit card|charge/.test(t)) return 'revolving'
  return t.slice(0, 24)
}

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function maskAccount(raw: string): string {
  const digits = accountDigits(raw)
  if (digits.length >= 4) return `···${digits.slice(-4)}`
  if (digits.length > 0) return `···${digits}`
  return '—'
}

/**
 * Stable identity for matching across report versions.
 * Prefer creditor + last 4 digits (mask-safe). Fall back to creditor + type.
 */
export function tradelineMatchKey(tl: Tradeline, bureau: BureauCode): string | null {
  const creditor = normalizeCreditor(tl.creditor || '')
  if (!creditor) return null
  const digits = accountDigits(accountForBureau(tl, bureau))
  if (digits.length >= 4) {
    return `c4:${bureau}:${creditor}:${digits.slice(-4)}`
  }
  const type = normalizeType(tl.account_type || tl.item_category || '')
  if (type) return `ct:${bureau}:${creditor}:${type}`
  // Last resort — creditor only (risky for multi-account creditors; rematch step helps)
  return `c:${bureau}:${creditor}`
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

function isInquiryTradeline(tl: Tradeline): boolean {
  const blob = `${tl.account_type} ${tl.item_category} ${tl.status} ${tl.remarks}`.toLowerCase()
  return /inquir/.test(blob)
}

/** Pull calendar dates from free text and normalize to comparable tokens. */
function extractDateTokens(text: string): string[] {
  const out = new Set<string>()
  const months: Record<string, string> = {
    jan: '01',
    january: '01',
    feb: '02',
    february: '02',
    mar: '03',
    march: '03',
    apr: '04',
    april: '04',
    may: '05',
    jun: '06',
    june: '06',
    jul: '07',
    july: '07',
    aug: '08',
    august: '08',
    sep: '09',
    sept: '09',
    september: '09',
    oct: '10',
    october: '10',
    nov: '11',
    november: '11',
    dec: '12',
    december: '12',
  }

  // 7/18/2026 or 07/18/26
  for (const m of text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g)) {
    const month = m[1].padStart(2, '0')
    const day = m[2].padStart(2, '0')
    let year = m[3]
    if (year.length === 2) year = `20${year}`
    out.add(`${year}-${month}-${day}`)
  }
  // Jul 18, 2026 / July 18 2026
  for (const m of text.matchAll(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/gi
  )) {
    const month = months[m[1].toLowerCase()]
    if (month) out.add(`${m[3]}-${month}-${m[2].padStart(2, '0')}`)
  }
  // until Aug 2028 / Jan 2028
  for (const m of text.matchAll(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/gi
  )) {
    const month = months[m[1].toLowerCase()]
    if (month) out.add(`${m[2]}-${month}`)
  }
  return [...out]
}

function datesOverlap(a: string, b: string): boolean {
  const da = extractDateTokens(a)
  const db = extractDateTokens(b)
  if (!da.length || !db.length) return false
  return da.some((x) => db.some((y) => x === y || x.startsWith(y) || y.startsWith(x)))
}

/**
 * Status/remarks often fluctuate in wording without a real change.
 * Inquiry rephrasings ("Inquiry" → "Inquiry on record until…", date format swaps) are ignored.
 */
function meaningfulFieldChange(
  field: string,
  from: string,
  to: string,
  prev: Tradeline,
  curr: Tradeline
): boolean {
  if (from === to) return false

  const inquiry = isInquiryTradeline(prev) || isInquiryTradeline(curr)

  if (field === 'status' || field === 'remarks') {
    // Hard inquiries: wording/date-format churn is noise, not progress.
    if (inquiry) return false

    const a = from.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const b = to.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (a === b) return false

    const tokens = (s: string) => new Set(s.split(' ').filter(Boolean))
    const ta = tokens(a)
    const tb = tokens(b)
    if (ta.size && tb.size && [...ta].every((t) => tb.has(t)) && [...tb].every((t) => ta.has(t))) {
      return false
    }

    // Same underlying date(s), different prose → ignore
    if (datesOverlap(from, to)) return false

    // Both describe paying as agreed / current / open — cosmetic
    const payOk = (s: string) =>
      /pays?\s+as\s+agreed|paying\s+as\s+agreed|open\s*\/?\s*current|current/.test(s)
    if (payOk(a) && payOk(b) && !/late|delinq|charge|collect|past due/.test(a + b)) {
      return false
    }
  }

  const ma = parseMoney(from)
  const mb = parseMoney(to)
  if (ma != null && mb != null) return ma !== mb
  return from !== to
}

function diffMatchedFields(prev: Tradeline, curr: Tradeline): TradelineFieldChange['fields'] {
  const fields: TradelineFieldChange['fields'] = []
  for (const spec of DIFF_FIELDS) {
    const from = normalizeFieldValue(prev[spec.field] as string | undefined)
    const to = normalizeFieldValue(curr[spec.field] as string | undefined)
    if (!from && !to) continue
    if (!meaningfulFieldChange(String(spec.field), from, to, prev, curr)) continue
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

function accountsCompatible(a: Tradeline, b: Tradeline, bureau: BureauCode): boolean {
  if (normalizeCreditor(a.creditor) !== normalizeCreditor(b.creditor)) return false
  const da = accountDigits(accountForBureau(a, bureau))
  const db = accountDigits(accountForBureau(b, bureau))
  if (da.length >= 4 && db.length >= 4) return da.slice(-4) === db.slice(-4)
  if (da.length >= 2 && db.length >= 2 && (da.endsWith(db) || db.endsWith(da))) return true
  // No usable digits — same creditor + similar type
  const ta = normalizeType(a.account_type || a.item_category || '')
  const tb = normalizeType(b.account_type || b.item_category || '')
  if (ta && tb && ta === tb) return true
  // Both inquiries with no digits
  if (/inquir/i.test(a.account_type || '') && /inquir/i.test(b.account_type || '')) return true
  return false
}

/**
 * Pair leftover unmatched tradelines so mask-format differences don't create
 * false removed+added pairs for the same creditor account.
 */
function fuzzyPair(
  unmatchedPrev: Tradeline[],
  unmatchedCurr: Tradeline[],
  bureau: BureauCode
): { pairs: [Tradeline, Tradeline][]; stillPrev: Tradeline[]; stillCurr: Tradeline[] } {
  const pairs: [Tradeline, Tradeline][] = []
  const currLeft = unmatchedCurr.slice()
  const stillPrev: Tradeline[] = []

  for (const prev of unmatchedPrev) {
    const idx = currLeft.findIndex((c) => accountsCompatible(prev, c, bureau))
    if (idx >= 0) {
      pairs.push([prev, currLeft[idx]])
      currLeft.splice(idx, 1)
    } else {
      stillPrev.push(prev)
    }
  }
  return { pairs, stillPrev, stillCurr: currLeft }
}

export function diffTradelinesForBureau(
  previousReport: ParsedReport | null | undefined,
  currentReport: ParsedReport | null | undefined,
  bureau: BureauCode
): TradelineProgressDiff {
  const prevList = bureauTradelines(previousReport, bureau)
  const currList = bureauTradelines(currentReport, bureau)

  // Exact key maps (first wins per key; duplicates handled via fuzzy later)
  const prevByKey = new Map<string, Tradeline>()
  const currByKey = new Map<string, Tradeline>()
  const prevDupes: Tradeline[] = []
  const currDupes: Tradeline[] = []

  for (const tl of prevList) {
    const key = tradelineMatchKey(tl, bureau)
    if (!key) {
      prevDupes.push(tl)
      continue
    }
    if (prevByKey.has(key)) prevDupes.push(tl)
    else prevByKey.set(key, tl)
  }
  for (const tl of currList) {
    const key = tradelineMatchKey(tl, bureau)
    if (!key) {
      currDupes.push(tl)
      continue
    }
    if (currByKey.has(key)) currDupes.push(tl)
    else currByKey.set(key, tl)
  }

  const pairs: [Tradeline, Tradeline][] = []
  const unmatchedPrev: Tradeline[] = [...prevDupes]
  const unmatchedCurr: Tradeline[] = [...currDupes]

  for (const [key, prev] of prevByKey) {
    const curr = currByKey.get(key)
    if (curr) {
      pairs.push([prev, curr])
      currByKey.delete(key)
    } else {
      unmatchedPrev.push(prev)
    }
  }
  for (const curr of currByKey.values()) {
    unmatchedCurr.push(curr)
  }

  const fuzzy = fuzzyPair(unmatchedPrev, unmatchedCurr, bureau)
  pairs.push(...fuzzy.pairs)

  const removed = fuzzy.stillPrev.map((tl) => toChange(tl, bureau))
  const added = fuzzy.stillCurr.map((tl) => toChange(tl, bureau))
  const changed: TradelineFieldChange[] = []

  for (const [prev, curr] of pairs) {
    const fields = diffMatchedFields(prev, curr)
    if (fields.length > 0) {
      changed.push({
        creditor: curr.creditor || prev.creditor || 'Unknown',
        accountMask: maskAccount(
          accountForBureau(curr, bureau) || accountForBureau(prev, bureau)
        ),
        fields,
      })
    }
  }

  const matched = pairs.length
  const total = Math.max(prevList.length, currList.length, 1)
  let matchConfidence: TradelineProgressDiff['matchConfidence'] = 'low'
  if (matched / total >= 0.6) matchConfidence = 'high'
  else if (matched / total >= 0.3) matchConfidence = 'medium'

  return { removed, added, changed, matchConfidence }
}

export function emptyTradelineProgressDiff(): TradelineProgressDiff {
  return { removed: [], added: [], changed: [], matchConfidence: 'low' }
}
