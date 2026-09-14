import {
  buildCreditRepairProgressPdfBuffer,
  buildCreditRepairProgressPdfInput,
  type CreditRepairCompareMode,
  type CreditRepairProgressPdfInput,
} from '@/lib/credit-repair-progress-pdf'
import { displayClientName } from '@/lib/credit-intelligence-pdf'
import type { DisputeSessionListItem } from '@/lib/dispute-letters/types'

export function creditRepairProgressPdfFilename(input: CreditRepairProgressPdfInput): string {
  const rawName = displayClientName(input.clientName, 'Client')
  const safeName =
    rawName
      .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'Client'

  const dateSource = input.generatedAt || new Date().toISOString()
  const parsed = new Date(dateSource)
  const ymd = Number.isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10)

  const mode = input.compareMode === 'previous' ? 'vs-previous' : 'vs-first'
  return `Credit-Progress-${safeName}-${mode}-${ymd}.pdf`
}

export function prepareCreditRepairProgressPdfInput(params: {
  sessions: DisputeSessionListItem[]
  selectedSessionId: string
  compareMode?: CreditRepairCompareMode
  clientName?: string | null
}): CreditRepairProgressPdfInput | { error: string } {
  return buildCreditRepairProgressPdfInput(params)
}

export async function renderCreditRepairProgressPdf(
  input: CreditRepairProgressPdfInput
): Promise<Buffer> {
  try {
    const buffer = await buildCreditRepairProgressPdfBuffer(input)
    if (!buffer?.length || buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new Error('PDF renderer returned an invalid document')
    }
    return buffer
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || 'Unknown PDF error')
    console.error('[credit-repair-progress-pdf] render failed:', message)
    throw err instanceof Error ? err : new Error(message || 'Failed to generate PDF')
  }
}
