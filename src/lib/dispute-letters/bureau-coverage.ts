import type {
  BureauCode,
  BureauCoverage,
  BureauCoverageKind,
  CreditProgressHealthCounts,
  DisputeSessionListItem,
  ParsedReport,
  PerBureauHealth,
  Tradeline,
} from '@/lib/dispute-letters/types'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'

const BUREAU_ORDER: BureauCode[] = ['TUC', 'EXP', 'EQF']

const TRI_MERGE_RE = /3[\s_-]*bureau|tri[\s_-]*merge|all[\s_-]*three|credit[\s_-]*hero/i
const FILENAME_PATTERNS: { bureau: BureauCode; re: RegExp }[] = [
  { bureau: 'EXP', re: /experian|(?:^|[\s_\-./])exp(?:[\s_\-./]|$)/i },
  {
    bureau: 'TUC',
    re: /trans[\s_\-]*union|(?:^|[\s_\-./])tu(?:[\s_\-./]|$)|(?:^|[\s_\-./])tuc(?:[\s_\-./]|$)/i,
  },
  { bureau: 'EQF', re: /equifax|(?:^|[\s_\-./])eqf(?:[\s_\-./]|$)/i },
]

function scorePresent(value: number | null | undefined): boolean {
  return typeof value === 'number' && value >= 300 && value <= 850
}

export function accountForBureau(tl: Tradeline, bureau: BureauCode): string {
  if (bureau === 'EXP') return (tl.account_exp || '').trim()
  if (bureau === 'TUC') return (tl.account_tu || '').trim()
  return (tl.account_eqf || '').trim()
}

export function tradelineCoversBureau(tl: Tradeline, bureau: BureauCode): boolean {
  if ((tl.bureaus || []).includes(bureau)) return true
  return Boolean(accountForBureau(tl, bureau))
}

function isNegativeTradeline(tl: Tradeline): boolean {
  if (tl.is_collection) return true
  if ((tl.legal_flags || []).some((f) =>
    ['collection', 'charge_off', 'late_payment_error'].includes(f)
  )) {
    return true
  }
  const blob = `${tl.status} ${tl.remarks} ${tl.account_type} ${tl.past_due}`.toLowerCase()
  return /collection|charge.?off|delinquent|late|past due|derog|dispute|unpaid|foreclos|reposs/.test(
    blob
  )
}

export function bureauHealthCounts(
  report: ParsedReport | null | undefined,
  bureau: BureauCode
): CreditProgressHealthCounts {
  const tradelines = (report?.tradelines || []).filter((tl) => tradelineCoversBureau(tl, bureau))
  return {
    total_accounts: tradelines.length,
    negative_count: tradelines.filter(isNegativeTradeline).length,
    collection_count: tradelines.filter(
      (tl) => tl.is_collection || tl.item_category === 'collection'
    ).length,
  }
}

export function detectBureauCoverage(
  report: ParsedReport | null | undefined,
  fileName = ''
): BureauCoverage {
  const found = new Set<BureauCode>()
  let confidence: BureauCoverage['confidence'] = 'low'

  const scores = report?.credit_health?.scores
  if (scores) {
    if (scorePresent(scores.tuc)) found.add('TUC')
    if (scorePresent(scores.exp)) found.add('EXP')
    if (scorePresent(scores.eqf)) found.add('EQF')
    if (found.size > 0) confidence = 'high'
  }

  for (const tl of report?.tradelines || []) {
    for (const b of tl.bureaus || []) {
      if (BUREAU_ORDER.includes(b)) {
        found.add(b)
        if (confidence === 'low') confidence = 'medium'
      }
    }
    for (const b of BUREAU_ORDER) {
      if (accountForBureau(tl, b)) {
        found.add(b)
        if (confidence === 'low') confidence = 'medium'
      }
    }
  }

  const name = (fileName || '').trim()
  if (name) {
    if (TRI_MERGE_RE.test(name)) {
      for (const b of BUREAU_ORDER) found.add(b)
      if (confidence === 'low') confidence = 'medium'
    } else {
      for (const { bureau, re } of FILENAME_PATTERNS) {
        if (re.test(name)) {
          found.add(bureau)
        }
      }
    }
  }

  const bureaus = BUREAU_ORDER.filter((b) => found.has(b))
  if (bureaus.length === 0) {
    return { bureaus: [], coverage: 'single', confidence: 'low' }
  }

  let coverage: BureauCoverageKind
  if (bureaus.length >= 3) coverage = 'tri_merge'
  else if (bureaus.length === 2) coverage = 'dual'
  else coverage = 'single'

  return { bureaus, coverage, confidence }
}

export function getSessionBureauCoverage(session: DisputeSessionListItem): BureauCoverage {
  const stored = session.report_json?.bureau_coverage
  if (stored?.bureaus?.length) {
    return {
      bureaus: stored.bureaus.filter((b): b is BureauCode => BUREAU_ORDER.includes(b)),
      coverage: stored.coverage || 'single',
      confidence: stored.confidence || 'medium',
    }
  }
  return detectBureauCoverage(session.report_json, session.file_name)
}

export function formatBureauCoverageLabel(coverage: BureauCoverage): string {
  if (coverage.coverage === 'tri_merge' || coverage.bureaus.length >= 3) return '3-bureau'
  if (coverage.bureaus.length === 0) return 'Unknown bureau'
  return coverage.bureaus.map((b) => BUREAU_LABELS[b]).join(' + ')
}

export function bureauBadgeCodes(coverage: BureauCoverage): BureauCode[] {
  return coverage.bureaus.slice()
}

export function perBureauFromReport(
  report: ParsedReport | null | undefined
): Partial<Record<BureauCode, CreditProgressHealthCounts>> {
  const out: Partial<Record<BureauCode, CreditProgressHealthCounts>> = {}
  const stored = report?.credit_health?.per_bureau
  for (const bureau of BUREAU_ORDER) {
    const row = stored?.[bureau] as PerBureauHealth | undefined
    if (row) {
      out[bureau] = {
        total_accounts: row.total_accounts ?? null,
        negative_count: row.negative_count ?? null,
        collection_count: row.collection_count ?? null,
      }
    } else if (report) {
      const computed = bureauHealthCounts(report, bureau)
      if ((computed.total_accounts || 0) > 0) out[bureau] = computed
    }
  }
  return out
}
