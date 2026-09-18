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

/** Legal / bureau filler words that churn between report pulls. */
const CREDITOR_STOPWORDS = new Set([
  'na',
  'llc',
  'inc',
  'corp',
  'co',
  'company',
  'bank',
  'bk',
  'fcu',
  'cu',
  'federal',
  'union',
  'lending',
  'financial',
  'fin',
  'services',
  'svc',
  'svcs',
  'the',
  'of',
  'and',
  'national',
  'assoc',
  'association',
])

function creditorTokens(value: string): string[] {
  return normalizeCreditor(value)
    .split(' ')
    .filter((t) => t.length > 0 && !CREDITOR_STOPWORDS.has(t))
}

/** Collapse creditor to a comparable core (drop filler tokens + glued suffixes). */
function creditorCore(value: string): string {
  const tokens = creditorTokens(value)
  let compact = (tokens.length ? tokens.join('') : normalizeCreditor(value).replace(/\s+/g, '')).replace(
    /(bank|bk|fcu|cu|llc|inc|corp|na|lending|financial)+$/g,
    ''
  )
  return compact
}

/**
 * True when two creditor labels are the same account under different bureau/OCR wording
 * (CREDITONEBK ↔ CREDIT ONE BANK NA, CITADEL FCU ↔ CITADEL FEDERAL CRED U).
 */
export function creditorsSimilar(a: string, b: string): boolean {
  const na = normalizeCreditor(a)
  const nb = normalizeCreditor(b)
  if (!na || !nb) return false
  if (na === nb) return true

  const spacedA = na.replace(/\s+/g, '')
  const spacedB = nb.replace(/\s+/g, '')
  if (spacedA === spacedB) return true
  if (spacedA.length >= 4 && spacedB.length >= 4 && (spacedA.includes(spacedB) || spacedB.includes(spacedA))) {
    return true
  }

  const ca = creditorCore(a)
  const cb = creditorCore(b)
  if (ca && cb) {
    if (ca === cb) return true
    if (ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))) return true
  }

  const ta = creditorTokens(a)
  const tb = creditorTokens(b)
  if (!ta.length || !tb.length) return false

  const fa = ta.join('')
  const fb = tb.join('')
  if (fa === fb) return true
  if (fa.length >= 4 && fb.length >= 4 && (fa.includes(fb) || fb.includes(fa))) return true

  // Shared / truncated tokens (BANTER ↔ BANT, OLDNAV ↔ OLD NAV already handled above)
  for (const x of ta) {
    for (const y of tb) {
      if (x === y && x.length >= 3) return true
      if (Math.min(x.length, y.length) >= 3 && (x.startsWith(y) || y.startsWith(x))) return true
      if (x.length >= 4 && fb.includes(x)) return true
      if (y.length >= 4 && fa.includes(y)) return true
    }
  }

  return false
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

/** Prefer bureau-specific digits; fall back to any account field so empty slots don't orphan matches. */
function accountDigitsForMatch(tl: Tradeline, bureau: BureauCode): string {
  const primary = accountDigits(accountForBureau(tl, bureau))
  if (primary.length >= 4) return primary
  for (const raw of [tl.account_tu, tl.account_exp, tl.account_eqf]) {
    const d = accountDigits(raw || '')
    if (d.length >= 4) return d
  }
  return primary
}

const MONEY_FIELDS = new Set(['balance', 'past_due', 'credit_limit', 'high_credit'])

function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function isBlankMoneyPlaceholder(value: string): boolean {
  const t = value.trim()
  return !t || /^[-–—._]+$/.test(t) || /^(n\/?a|none|null)$/i.test(t)
}

/** `$0`, `-`, `—`, and blank are the same zero for progress diffs. */
export function moneyValuesEquivalent(from: string, to: string): boolean {
  const a = isBlankMoneyPlaceholder(from) ? 0 : parseMoney(from)
  const b = isBlankMoneyPlaceholder(to) ? 0 : parseMoney(to)
  return a != null && b != null && a === b
}

function maskAccount(raw: string): string {
  const digits = accountDigits(raw)
  if (digits.length >= 4) return `···${digits.slice(-4)}`
  if (digits.length > 0) return `···${digits}`
  return '—'
}

/** Last 4 account digits for matching, using any bureau slot if the primary is masked/empty. */
export function accountLast4ForMatch(tl: Tradeline, bureau: BureauCode): string {
  const digits = accountDigitsForMatch(tl, bureau)
  return digits.length >= 4 ? digits.slice(-4) : digits
}

export function last4FromMatchKey(key: string | null | undefined): string {
  const parts = String(key || '').split(':')
  if (parts[0] === 'a4' && /^\d{4}$/.test(parts[2] || '')) return parts[2]
  if (parts[0] === 'c4') {
    const last = parts[parts.length - 1] || ''
    if (/^\d{4}$/.test(last)) return last
  }
  return ''
}

export function bureauFromMatchKey(key: string | null | undefined): string {
  return String(key || '').split(':')[1] || ''
}

/**
 * Tokens that identify the same bureau account across name/OCR variants.
 * Account last-4 is the durable id; creditor name is not required when last-4 exists.
 */
export function accountMatchTokens(input: {
  bureau?: string | null
  accountLast4?: string | null
  matchKey?: string | null
}): string[] {
  const tokens = new Set<string>()
  const matchKey = String(input.matchKey || '').trim()
  if (matchKey) tokens.add(matchKey)
  const bureauRaw = String(input.bureau || bureauFromMatchKey(matchKey) || '')
    .trim()
    .toUpperCase()
  const bureau = bureauRaw === 'TU' ? 'TUC' : bureauRaw
  let last4 = String(input.accountLast4 || '')
    .replace(/\D/g, '')
    .slice(-4)
  if (last4.length < 4) last4 = last4FromMatchKey(matchKey)
  if (bureau && last4.length >= 4) tokens.add(`a4:${bureau}:${last4}`)
  return [...tokens]
}

export function accountMatchTokensOverlap(
  left: Parameters<typeof accountMatchTokens>[0],
  right: Parameters<typeof accountMatchTokens>[0]
): boolean {
  const rightSet = new Set(accountMatchTokens(right))
  return accountMatchTokens(left).some((token) => rightSet.has(token))
}

/**
 * Stable identity for matching across report versions.
 * Prefer bureau + last 4 digits so renamed creditors (KIKOFF vs KIKOFF LENDING LLC)
 * stay one account. Fall back to creditor core + type when digits are missing.
 */
export function tradelineMatchKey(tl: Tradeline, bureau: BureauCode): string | null {
  const last4 = accountLast4ForMatch(tl, bureau)
  if (last4.length >= 4) return `a4:${bureau}:${last4}`
  const core = creditorCore(tl.creditor || '')
  if (!core) return null
  const type = normalizeType(tl.account_type || tl.item_category || '')
  if (type) return `ct:${bureau}:${core}:${type}`
  return `c:${bureau}:${core}`
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

const BUREAU_PREFIX_RE = /\b(exp|eqf|tu|tuc|experian|equifax|transunion)\b:?/gi

export function normalizeStatusRemark(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(BUREAU_PREFIX_RE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasDerogatoryCreditEvent(normalized: string): boolean {
  const withoutNeverLate = normalized
    .replace(/\bnever late\b/g, ' ')
    .replace(/\bno late(?:s| payments?)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return /charge ?off|collection|delinq|past due|\blate\b|reposs|foreclos|settlement|profit and loss|placed for collection/.test(
    withoutNeverLate
  )
}

function isClosedAccountWording(normalized: string): boolean {
  return (
    /\bclosed\b/.test(normalized) ||
    /\bpaid in full\b/.test(normalized) ||
    /\bpaid off\b/.test(normalized)
  )
}

function isOpenOrCurrentWording(normalized: string): boolean {
  return (
    /\bopen\b/.test(normalized) ||
    /\bcurrent\b/.test(normalized) ||
    /pays? (?:\w+ )?as agreed/.test(normalized) ||
    /paying as agreed/.test(normalized) ||
    /\bnever late\b/.test(normalized) ||
    /good standing/.test(normalized) ||
    /paid satisfactorily/.test(normalized)
  )
}

/** Drop bureau responsibility labels and plural churn so term text can match. */
function remarkComparableCore(normalized: string): string {
  return normalized
    .replace(/\b(?:individual|joint|shared|authorized user)\s+responsibility\b/g, ' ')
    .replace(/\bterms\b/g, 'term')
    .replace(/\bmonths\b/g, 'month')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Same meaning, different bureau wording — not a tradeline change.
 * Covers clean open, clean closed, and term text plus responsibility labels.
 */
export function statusRemarksEquivalent(from: string, to: string): boolean {
  if (from === to) return true
  const a = normalizeStatusRemark(from)
  const b = normalizeStatusRemark(to)
  if (!a || !b) return false
  if (a === b) return true

  const aDerog = hasDerogatoryCreditEvent(a)
  const bDerog = hasDerogatoryCreditEvent(b)
  if (aDerog !== bDerog) return false

  const aClosed = isClosedAccountWording(a)
  const bClosed = isClosedAccountWording(b)
  const aOpen = isOpenOrCurrentWording(a)
  const bOpen = isOpenOrCurrentWording(b)

  if (aClosed && bClosed && !aDerog && !bDerog) return true
  if (aOpen && bOpen && !aClosed && !bClosed && !aDerog && !bDerog) return true

  const ca = remarkComparableCore(a)
  const cb = remarkComparableCore(b)
  return Boolean(ca && cb && ca === cb)
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

    if (statusRemarksEquivalent(from, to)) return false
  }

  if (MONEY_FIELDS.has(field) || isBlankMoneyPlaceholder(from) || isBlankMoneyPlaceholder(to)) {
    if (moneyValuesEquivalent(from, to)) return false
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

function last4(tl: Tradeline, bureau: BureauCode): string | null {
  const d = accountDigitsForMatch(tl, bureau)
  return d.length >= 4 ? d.slice(-4) : null
}

function accountsCompatible(a: Tradeline, b: Tradeline, bureau: BureauCode): boolean {
  const similar = creditorsSimilar(a.creditor || '', b.creditor || '')
  if (!similar) return false

  const da = accountDigitsForMatch(a, bureau)
  const db = accountDigitsForMatch(b, bureau)

  // Both have last4 — must agree (never cross-wire sibling accounts at same creditor)
  if (da.length >= 4 && db.length >= 4) {
    return da.slice(-4) === db.slice(-4)
  }
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
 * Pair leftover unmatched tradelines so mask-format / creditor-rename differences
 * don't create false removed+added pairs for the same account.
 */
function fuzzyPair(
  unmatchedPrev: Tradeline[],
  unmatchedCurr: Tradeline[],
  bureau: BureauCode
): { pairs: [Tradeline, Tradeline][]; stillPrev: Tradeline[]; stillCurr: Tradeline[] } {
  const pairs: [Tradeline, Tradeline][] = []
  const currLeft = unmatchedCurr.slice()
  const stillPrev: Tradeline[] = []

  // Pass 1: last4 is the durable id (KIKOFF vs KIKOFF LENDING LLC, SYNCB vs SYNCHRONY)
  for (const prev of unmatchedPrev) {
    const p4 = last4(prev, bureau)
    let idx = -1
    if (p4) {
      idx = currLeft.findIndex((c) => last4(c, bureau) === p4)
    }
    if (idx < 0) {
      idx = currLeft.findIndex((c) => accountsCompatible(prev, c, bureau))
    }
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
