import type { ParsedReport } from './types'

/** Accounts that a dispute letter could cover (inquiries don't count). */
export function readAccountCount(report: ParsedReport | null | undefined): number {
  return (report?.tradelines || []).filter(
    (t) => !/inquir/i.test(`${t.account_type || ''} ${t.item_category || ''}`)
  ).length
}

/** Plain-English reason shown when a finished report has no accounts. Null when accounts were read. */
export function emptyReportMessage(report: ParsedReport | null | undefined): string | null {
  if (!report || readAccountCount(report) > 0) return null
  if (report.ocr_used && report.extraction_quality === 'low') {
    return 'No accounts were read from this report. It is a scan or screenshot and very little text came out of it. Take screenshots at normal zoom with the account details showing, then upload them all at once so they are read as one report.'
  }
  if (report.ocr_used) {
    return 'No accounts were read from this report. The screenshot text was read, but the account layout is not one the system knows yet. Send this file to MC so the layout can be added.'
  }
  return 'No accounts were read from this report. Its layout is not one the system knows yet, so dispute letters cannot be built from it. Upload the bureau’s original PDF, or send this file to MC so the layout can be added.'
}
