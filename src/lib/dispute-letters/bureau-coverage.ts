import { isInquiryTradeline } from '@/lib/dispute-letters/dispute-reasons'
import type {
  BureauCode,
  BureauCoverage,
  BureauCoverageKind,
  BureauScores,
  CreditIntelligenceReport,
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

export function scorePresent(value: number | null | undefined): boolean {
  return typeof value === 'number' && value >= 300 && value <= 850
}

export function intelligenceFromSession(
  session: DisputeSessionListItem
): CreditIntelligenceReport | null {
  return session.intelligence_json || session.report_json?.credit_intelligence || null
}

/** Report date the client sees for an upload, falling back to the upload timestamp. */
export function sessionReportDate(session: DisputeSessionListItem): string {
  return (
    intelligenceFromSession(session)?.report_date ||
    session.report_json?.report_date ||
    session.created_at
  )
}

function bureauScoreKey(bureau: BureauCode): keyof BureauScores {
  if (bureau === 'EXP') return 'exp'
  if (bureau === 'TUC') return 'tuc'
  return 'eqf'
}

/**
 * Resolve per-bureau scores for progress tracking.
 * Follow-up single-bureau uploads often parse tradelines but miss credit_health.scores;
 * in that case the intelligence overall average is that bureau's score.
 *
 * A multi-bureau report never borrows the average for a bureau whose score is missing:
 * on a tri-merge the average is computed from the bureaus that did report, so handing it
 * to the missing one invents a score for a bureau that has nothing on file.
 */
export function resolveSessionBureauScores(
  session: DisputeSessionListItem,
  intelligence: CreditIntelligenceReport
): BureauScores {
  const raw = session.report_json?.credit_health?.scores
  const scores: BureauScores = {
    tuc: raw?.tuc ?? null,
    exp: raw?.exp ?? null,
    eqf: raw?.eqf ?? null,
  }

  const avg = intelligence.overall?.average_score
  if (!scorePresent(avg)) return scores

  const coverage = getSessionBureauCoverage(session)
  if (coverage.bureaus.length !== 1) return scores

  const key = bureauScoreKey(coverage.bureaus[0])
  if (!scorePresent(scores[key])) scores[key] = avg
  return scores
}

/** Per-bureau scores for a session whether or not intelligence has been generated yet. */
export function sessionBureauScores(session: DisputeSessionListItem): BureauScores {
  const intelligence = intelligenceFromSession(session)
  if (intelligence) return resolveSessionBureauScores(session, intelligence)
  const raw = session.report_json?.credit_health?.scores
  return {
    tuc: raw?.tuc ?? null,
    exp: raw?.exp ?? null,
    eqf: raw?.eqf ?? null,
  }
}

export function bureauScoreValue(
  scores: BureauScores | null | undefined,
  bureau: BureauCode
): number | null {
  if (!scores) return null
  return scores[bureauScoreKey(bureau)] ?? null
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

const POSITIVE_LATE_RE = /never\s+late|no\s+late(?:\s+payments?)?|\bnot\s+late\b/gi
const RESOLVED_DISPUTE_RE = /(?:previously\s+(?:in\s+)?)?dispute[\s\S]{0,80}?(?:now\s+)?resolved/gi
const DEROG_RE =
  /collection|charge.?off|delinquent|\bpast\s+due\b|\blate\b|derog|\bunpaid\b|foreclos|reposs|\bin\s+dispute\b/i

/** Derogatory tradeline: collection, charge-off, actual late/past-due history — not "never late". */
export function isNegativeTradeline(tl: Tradeline): boolean {
  if (tl.is_collection || (tl.item_category || '') === 'collection') return true
  if ((tl.legal_flags || []).some((f) =>
    ['collection', 'charge_off', 'late_payment_error'].includes(f)
  )) {
    return true
  }
  const blob = `${tl.status} ${tl.remarks} ${tl.account_type} ${tl.past_due}`
  const cleaned = blob.replace(POSITIVE_LATE_RE, ' ').replace(RESOLVED_DISPUTE_RE, ' ')
  return DEROG_RE.test(cleaned)
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
    inquiry_count: tradelines.filter(isInquiryTradeline).length,
  }
}

export function filenameBureauHint(fileName = ''): BureauCode[] {
  const name = (fileName || '').trim()
  if (!name) return []
  if (TRI_MERGE_RE.test(name)) return [...BUREAU_ORDER]
  const found = new Set<BureauCode>()
  for (const { bureau, re } of FILENAME_PATTERNS) {
    if (re.test(name)) found.add(bureau)
  }
  return BUREAU_ORDER.filter((bureau) => found.has(bureau))
}

/** A bureau is only "covered" when the report actually reports something for it. */
export function reportHasBureauEvidence(
  report: ParsedReport | null | undefined,
  bureau: BureauCode
): boolean {
  if (!report) return false
  if (scorePresent(bureauScoreValue(report.credit_health?.scores, bureau))) return true
  if ((report.tradelines || []).some((tl) => tradelineCoversBureau(tl, bureau))) return true
  const stored = report.credit_health?.per_bureau?.[bureau]
  return (stored?.total_accounts ?? 0) > 0
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

  // The filename is only a guess about what the file should hold. Once the parsed report
  // shows which bureaus actually reported, that evidence wins: a 3-bureau export where
  // Equifax returned nothing must not be counted as covering Equifax.
  if (found.size === 0) {
    for (const bureau of filenameBureauHint(fileName)) {
      found.add(bureau)
      if (confidence === 'low') confidence = 'medium'
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
    const claimed = stored.bureaus.filter((b): b is BureauCode => BUREAU_ORDER.includes(b))
    // Reports analyzed before coverage required evidence can claim a bureau the file never
    // reported. Drop those, but only when some other bureau did report — a report that
    // parsed no per-bureau detail at all still has to fall back to what was stored.
    const evidenced = claimed.filter((b) => reportHasBureauEvidence(session.report_json, b))
    const bureaus = evidenced.length > 0 ? evidenced : claimed
    return {
      bureaus,
      coverage:
        bureaus.length === claimed.length
          ? stored.coverage || 'single'
          : bureaus.length >= 3
            ? 'tri_merge'
            : bureaus.length === 2
              ? 'dual'
              : 'single',
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
    const computed = report ? bureauHealthCounts(report, bureau) : null
    if (computed && (computed.total_accounts || 0) > 0) {
      out[bureau] = computed
      continue
    }
    const row = stored?.[bureau] as PerBureauHealth | undefined
    if (row) {
      out[bureau] = {
        total_accounts: row.total_accounts ?? null,
        negative_count: row.negative_count ?? null,
        collection_count: row.collection_count ?? null,
        inquiry_count: row.inquiry_count ?? null,
      }
    }
  }
  return out
}
