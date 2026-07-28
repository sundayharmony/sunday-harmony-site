import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { CreditIntelligencePdfDocument } from '@/lib/credit-intelligence-pdf'
import type { CreditIntelligenceReport } from '@/lib/dispute-letters/types'

export function creditIntelligencePdfFilename(report: CreditIntelligenceReport): string {
  const rawName = (report.consumer_name || 'Client').trim() || 'Client'
  const safeName = rawName
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
  const element = React.createElement(CreditIntelligencePdfDocument, {
    report,
  }) as unknown as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)
  return Buffer.from(buffer)
}
