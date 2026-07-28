import {
  buildCreditIntelligencePdfBuffer,
} from '@/lib/credit-intelligence-pdf'
import type { CreditIntelligenceReport } from '@/lib/dispute-letters/types'

export function creditIntelligencePdfFilename(report: CreditIntelligenceReport): string {
  const rawName = (report.consumer_name || 'Client').trim() || 'Client'
  const safeName =
    rawName
      .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'Client'

  const dateSource = report.analyzed_at || report.report_date || new Date().toISOString()
  const parsed = new Date(dateSource)
  const ymd = Number.isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10)

  return `Credit-Analysis-${safeName}-${ymd}.pdf`
}

export async function renderCreditIntelligencePdf(
  report: CreditIntelligenceReport
): Promise<Buffer> {
  try {
    const buffer = await buildCreditIntelligencePdfBuffer(report)
    if (!buffer?.length || buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new Error('PDF renderer returned an invalid document')
    }
    return buffer
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || 'Unknown PDF error')
    console.error('[credit-intelligence-pdf] render failed:', message)
    throw err instanceof Error ? err : new Error(message || 'Failed to generate PDF')
  }
}
