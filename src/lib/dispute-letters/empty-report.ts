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
  if (report.ocr_used) {
    return 'No accounts were read from this report. It is a scan or screenshot and the text could not be read. Download the PDF straight from the bureau or monitoring site (not a screenshot) and upload that.'
  }
  return 'No accounts were read from this report. Its layout is not one the system knows yet, so dispute letters cannot be built from it. Upload the bureau’s original PDF, or send this file to MC so the layout can be added.'
}
