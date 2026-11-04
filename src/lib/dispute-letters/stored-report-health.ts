import type { ParsedReport, RepairPriority, ReportHealth, Tradeline } from '@/lib/dispute-letters/types'

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
}

export function tradelinesByPriority(tradelines: Tradeline[]): Tradeline[] {
  return [...tradelines].sort((a, b) => {
    const rankA = PRIORITY_RANK[String(a.repair_priority || 'none')] ?? 3
    const rankB = PRIORITY_RANK[String(b.repair_priority || 'none')] ?? 3
    if (rankA !== rankB) return rankA - rankB
    return (a.creditor || '').localeCompare(b.creditor || '')
  })
}

/**
 * Health already saved on the session. Opening the tab should not wake the
 * letter service again just to re-read the same report.
 */
export function healthFromStoredReport(
  sessionId: string,
  report: ParsedReport | null | undefined
): ReportHealth | null {
  if (!report?.credit_health || !report.tradelines?.length) return null
  return {
    session_id: sessionId,
    credit_health: report.credit_health,
    credit_intelligence: report.credit_intelligence || null,
    tradelines_by_priority: tradelinesByPriority(report.tradelines),
    consumer_name: report.consumer?.name || '',
    report_date: report.report_date || '',
    source: report.source || '',
  }
}

export function priorityRank(priority: RepairPriority | string | undefined): number {
  return PRIORITY_RANK[String(priority || 'none')] ?? 3
}
