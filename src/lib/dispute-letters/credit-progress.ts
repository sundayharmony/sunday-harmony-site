import type {
  CreditIntelligenceReport,
  CreditProgressDelta,
  CreditProgressDirection,
  CreditProgressHealthCounts,
  CreditProgressReport,
  CreditProgressSnapshot,
  DisputeSessionListItem,
} from '@/lib/dispute-letters/types'
import { FACTOR_LABELS } from '@/lib/dispute-letters/types'

/** Higher = healthier. Unknown bands land at -1. */
const BAND_RANK: Record<string, number> = {
  exceptional: 6,
  excellent: 6,
  very_good: 5,
  strong: 5,
  good: 4,
  moderate: 3,
  fair: 2,
  mixed: 2,
  developing: 2,
  poor: 1,
  weak: 1,
  limited: 1,
  severe: 0,
  critical: 0,
}

const FUNDING_LEVEL_RANK: Record<string, number> = {
  high: 4,
  strong: 4,
  moderate: 3,
  developing: 2,
  limited: 1,
  low: 1,
  weak: 1,
  not_ready: 0,
  blocked: 0,
}

function intelligenceFromSession(s: DisputeSessionListItem): CreditIntelligenceReport | null {
  return s.intelligence_json || s.report_json?.credit_intelligence || null
}

function normalizeKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function bandRank(band: string | null | undefined, table: Record<string, number>): number {
  const key = normalizeKey(band)
  if (!key) return -1
  if (key in table) return table[key]
  for (const [k, v] of Object.entries(table)) {
    if (key.includes(k)) return v
  }
  return -1
}

function formatBand(value: string | null | undefined): string | null {
  if (!value) return null
  return value.replace(/_/g, ' ')
}

export function snapshotFromSession(session: DisputeSessionListItem): CreditProgressSnapshot | null {
  const intelligence = intelligenceFromSession(session)
  if (!intelligence) return null

  const health = session.report_json?.credit_health
  const healthCounts: CreditProgressHealthCounts = {
    total_accounts: health?.total_accounts ?? null,
    negative_count: health?.negative_count ?? null,
    collection_count: health?.collection_count ?? null,
  }

  const factorBands: Record<string, string> = {}
  for (const factor of intelligence.factors || []) {
    if (factor.factor) factorBands[factor.factor] = factor.score_band
  }

  return {
    sessionId: session.id,
    createdAt: session.created_at,
    reportDate: intelligence.report_date || session.report_json?.report_date || session.created_at,
    analyzedAt: intelligence.analyzed_at || session.updated_at,
    fileName: session.file_name,
    overallBand: intelligence.overall?.band ?? null,
    averageScore: intelligence.overall?.average_score ?? null,
    fundingLevel: intelligence.funding_readiness?.level ?? null,
    fundingScore: intelligence.funding_readiness?.score_0_to_100 ?? null,
    factorBands,
    healthCounts,
  }
}

function numericDirection(
  from: number | null,
  to: number | null,
  higherIsBetter: boolean
): CreditProgressDirection {
  if (from == null || to == null) return 'unknown'
  if (from === to) return 'unchanged'
  const rose = to > from
  if (higherIsBetter) return rose ? 'improved' : 'worsened'
  return rose ? 'worsened' : 'improved'
}

function bandDirection(
  from: string | null,
  to: string | null,
  table: Record<string, number>
): CreditProgressDirection {
  if (!from || !to) return 'unknown'
  const a = bandRank(from, table)
  const b = bandRank(to, table)
  if (a < 0 || b < 0) {
    return normalizeKey(from) === normalizeKey(to) ? 'unchanged' : 'unknown'
  }
  if (a === b) return 'unchanged'
  return b > a ? 'improved' : 'worsened'
}

function pushDelta(
  out: CreditProgressDelta[],
  field: string,
  label: string,
  from: string | number | null,
  to: string | number | null,
  direction: CreditProgressDirection
) {
  out.push({ field, label, from, to, direction })
}

export function diffSnapshots(
  from: CreditProgressSnapshot,
  to: CreditProgressSnapshot
): CreditProgressDelta[] {
  const deltas: CreditProgressDelta[] = []

  pushDelta(
    deltas,
    'average_score',
    'Average score',
    from.averageScore,
    to.averageScore,
    numericDirection(from.averageScore, to.averageScore, true)
  )
  pushDelta(
    deltas,
    'overall_band',
    'Overall band',
    formatBand(from.overallBand),
    formatBand(to.overallBand),
    bandDirection(from.overallBand, to.overallBand, BAND_RANK)
  )
  pushDelta(
    deltas,
    'funding_score',
    'Funding readiness score',
    from.fundingScore,
    to.fundingScore,
    numericDirection(from.fundingScore, to.fundingScore, true)
  )
  pushDelta(
    deltas,
    'funding_level',
    'Funding readiness',
    formatBand(from.fundingLevel),
    formatBand(to.fundingLevel),
    bandDirection(from.fundingLevel, to.fundingLevel, FUNDING_LEVEL_RANK)
  )
  pushDelta(
    deltas,
    'negative_count',
    'Negative items',
    from.healthCounts.negative_count,
    to.healthCounts.negative_count,
    numericDirection(from.healthCounts.negative_count, to.healthCounts.negative_count, false)
  )
  pushDelta(
    deltas,
    'collection_count',
    'Collections',
    from.healthCounts.collection_count,
    to.healthCounts.collection_count,
    numericDirection(from.healthCounts.collection_count, to.healthCounts.collection_count, false)
  )
  pushDelta(
    deltas,
    'total_accounts',
    'Total accounts',
    from.healthCounts.total_accounts,
    to.healthCounts.total_accounts,
    from.healthCounts.total_accounts == null || to.healthCounts.total_accounts == null
      ? 'unknown'
      : from.healthCounts.total_accounts === to.healthCounts.total_accounts
        ? 'unchanged'
        : 'unknown'
  )

  const factorKeys = new Set([
    ...Object.keys(from.factorBands),
    ...Object.keys(to.factorBands),
  ])
  for (const key of [...factorKeys].sort()) {
    const fromBand = from.factorBands[key] ?? null
    const toBand = to.factorBands[key] ?? null
    if (!fromBand && !toBand) continue
    const label = FACTOR_LABELS[key] || key.replace(/_/g, ' ')
    pushDelta(
      deltas,
      `factor:${key}`,
      label,
      formatBand(fromBand),
      formatBand(toBand),
      bandDirection(fromBand, toBand, BAND_RANK)
    )
  }

  return deltas
}

/** Sessions may arrive newest-first; helper sorts oldest→newest for baseline/previous. */
export function buildCreditProgressDiff(
  sessions: DisputeSessionListItem[],
  selectedSessionId: string | null | undefined
): CreditProgressReport {
  const readyWithIntel = sessions
    .filter((s) => s.status === 'ready')
    .map((s) => ({ session: s, snap: snapshotFromSession(s) }))
    .filter((x): x is { session: DisputeSessionListItem; snap: CreditProgressSnapshot } => !!x.snap)
    .sort(
      (a, b) =>
        new Date(a.session.created_at).getTime() - new Date(b.session.created_at).getTime()
    )

  const readyCount = readyWithIntel.length
  if (readyCount === 0) {
    return {
      baseline: null,
      previous: null,
      current: null,
      vsBaseline: [],
      vsPrevious: [],
      readyCount: 0,
    }
  }

  const baseline = readyWithIntel[0]
  const selectedIndex = selectedSessionId
    ? readyWithIntel.findIndex((x) => x.session.id === selectedSessionId)
    : readyCount - 1
  const currentIndex = selectedIndex >= 0 ? selectedIndex : readyCount - 1
  const current = readyWithIntel[currentIndex]
  const previous = currentIndex > 0 ? readyWithIntel[currentIndex - 1] : null

  const vsBaseline =
    current.session.id !== baseline.session.id
      ? diffSnapshots(baseline.snap, current.snap)
      : []
  const vsPrevious =
    previous && previous.session.id !== current.session.id
      ? diffSnapshots(previous.snap, current.snap)
      : []

  return {
    baseline: baseline.snap,
    previous: previous?.snap ?? null,
    current: current.snap,
    vsBaseline,
    vsPrevious,
    readyCount,
  }
}

export function formatProgressDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
