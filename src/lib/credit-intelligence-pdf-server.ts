import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { CreditIntelligencePdfDocument } from '@/lib/credit-intelligence-pdf'
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

function friendlyPdfError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err || 'Unknown PDF error')
  if (/Minified React error #31|Objects are not valid as a React child/i.test(message)) {
    return new Error(
      'Could not build the Credit Analysis PDF from this report. Try Refresh with funding context, then download again.'
    )
  }
  return err instanceof Error ? err : new Error(message || 'Failed to generate PDF')
}

export async function renderCreditIntelligencePdf(
  report: CreditIntelligenceReport
): Promise<Buffer> {
  try {
    const element = createElement(CreditIntelligencePdfDocument, {
      report,
    }) as ReactElement<DocumentProps>
    return await renderToBuffer(element)
  } catch (err) {
    throw friendlyPdfError(err)
  }
}
