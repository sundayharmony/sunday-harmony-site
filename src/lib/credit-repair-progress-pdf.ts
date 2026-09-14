import PDFDocument from 'pdfkit'
import {
  buildAllBureauProgress,
  formatProgressDate,
} from '@/lib/dispute-letters/credit-progress'
import { asText, displayClientName } from '@/lib/credit-intelligence-pdf'
import type {
  BureauCode,
  CreditProgressDelta,
  CreditProgressReport,
  DisputeSessionListItem,
  TradelineProgressDiff,
} from '@/lib/dispute-letters/types'
import { BUREAU_LABELS } from '@/lib/dispute-letters/types'

const COLORS = {
  text: '#0a0a0a',
  muted: '#5c5c5c',
  dim: '#8a8a8a',
  accent: '#b8943f',
  border: '#e5e2dc',
  softBg: '#faf9f7',
  white: '#ffffff',
  emerald: '#047857',
  emeraldSoft: '#ecfdf5',
  red: '#991b1b',
  redSoft: '#fef2f2',
  amber: '#92400e',
  amberSoft: '#fffbeb',
}

const BUREAU_ORDER: BureauCode[] = ['TUC', 'EXP', 'EQF']

/** Credit-profile metrics only — never include funding_* fields. */
const CREDIT_METRIC_FIELDS = new Set([
  'bureau_score',
  'negative_count',
  'collection_count',
  'total_accounts',
  'average_score',
  'overall_band',
])

export type CreditRepairCompareMode = 'baseline' | 'previous'

export type CreditRepairProgressPdfInput = {
  clientName: string
  compareMode: CreditRepairCompareMode
  generatedAt?: string
  progressByBureau: Partial<Record<BureauCode, CreditProgressReport>>
}

type Doc = PDFKit.PDFDocument

function contentWidth(doc: Doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function ensureSpace(doc: Doc, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (doc.y + needed > bottom) doc.addPage()
}

function drawFooter(doc: Doc, pageNumber: number) {
  const savedX = doc.x
  const savedY = doc.y
  const savedBottom = doc.page.margins.bottom
  doc.page.margins.bottom = 0
  try {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.dim)
      .text(`Page ${pageNumber} · Credit Progress Report · Sunday Harmony`, doc.page.margins.left, doc.page.height - 36, {
        width: contentWidth(doc),
        align: 'center',
        lineBreak: false,
      })
  } finally {
    doc.page.margins.bottom = savedBottom
    doc.x = savedX
    doc.y = savedY
  }
}

function scoreForBureau(report: CreditProgressReport, which: 'from' | 'to', compareMode: CreditRepairCompareMode): number | null {
  const bureau = report.bureau
  if (!bureau) return null
  const snap =
    which === 'to'
      ? report.current
      : compareMode === 'previous' && report.previous
        ? report.previous
        : report.baseline
  if (!snap) return null
  if (bureau === 'EXP') return snap.bureauScores.exp
  if (bureau === 'TUC') return snap.bureauScores.tuc
  return snap.bureauScores.eqf
}

function activeDeltas(report: CreditProgressReport, compareMode: CreditRepairCompareMode): CreditProgressDelta[] {
  const raw =
    compareMode === 'previous' && (report.vsPrevious?.length || 0) > 0
      ? report.vsPrevious
      : report.vsBaseline
  return (raw || []).filter((d) => CREDIT_METRIC_FIELDS.has(d.field) || d.field.startsWith('factor:'))
}

function activeAccountDiff(
  report: CreditProgressReport,
  compareMode: CreditRepairCompareMode
): TradelineProgressDiff | null | undefined {
  if (compareMode === 'previous' && report.accountChangesVsPrevious) {
    return report.accountChangesVsPrevious
  }
  return report.accountChangesVsBaseline
}

function formatDeltaValue(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  return String(value)
}

function directionColor(direction: string): string {
  if (direction === 'improved') return COLORS.emerald
  if (direction === 'worsened') return COLORS.red
  return COLORS.muted
}

/**
 * Build a client-facing credit repair before/after PDF.
 * Scores + account changes only — no funding eligibility content.
 */
export function buildCreditRepairProgressPdfBuffer(
  input: CreditRepairProgressPdfInput
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 48, bottom: 52, left: 48, right: 48 },
      info: {
        Title: 'Credit Progress Report',
        Author: 'Sunday Harmony',
        Subject: 'Before and after credit profile comparison',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    let pageNumber = 1
    doc.on('pageAdded', () => {
      pageNumber += 1
      drawFooter(doc, pageNumber)
    })
    drawFooter(doc, pageNumber)

    const client = displayClientName(input.clientName, 'Client')
    const compareLabel =
      input.compareMode === 'previous' ? 'Previous report → Current' : 'First report → Current'
    const generated = formatProgressDate(input.generatedAt || new Date().toISOString())

    // Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.text).text('Sunday Harmony')
    doc.moveDown(0.15)
    doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.accent).text('Credit Progress Report')
    doc.moveDown(0.25)
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
    doc.text(`Prepared for ${client}`)
    doc.text(`Comparison: ${compareLabel}`)
    doc.text(`Generated ${generated}`)
    doc.moveDown(0.4)
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + contentWidth(doc), doc.y)
      .strokeColor(COLORS.border)
      .stroke()
    doc.moveDown(0.55)

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        'This report summarizes credit score movement and specific account-level changes between the compared credit reports. It is for educational progress tracking only and is not a credit score product, funding decision, or legal advice.',
        { width: contentWidth(doc) }
      )
    doc.moveDown(0.7)

    const bureaus = BUREAU_ORDER.filter((b) => {
      const report = input.progressByBureau[b]
      return report && report.readyCount >= 2 && report.current && report.baseline
    })

    if (bureaus.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor(COLORS.text).text('No comparable bureau reports are available yet.')
      doc.end()
      return
    }

    for (const bureau of bureaus) {
      const report = input.progressByBureau[bureau]!
      const fromScore = scoreForBureau(report, 'from', input.compareMode)
      const toScore = scoreForBureau(report, 'to', input.compareMode)
      const deltas = activeDeltas(report, input.compareMode)
      const accounts = activeAccountDiff(report, input.compareMode)
      const fromSnap =
        input.compareMode === 'previous' && report.previous ? report.previous : report.baseline
      const toSnap = report.current

      ensureSpace(doc, 120)
      doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text).text(BUREAU_LABELS[bureau])
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.dim)
        .text(
          `${formatProgressDate(fromSnap?.reportDate || fromSnap?.createdAt)} → ${formatProgressDate(toSnap?.reportDate || toSnap?.createdAt)}`
        )
      doc.moveDown(0.35)

      // Score hero row
      const scoreDelta =
        fromScore != null && toScore != null ? toScore - fromScore : null
      const scoreColor =
        scoreDelta == null ? COLORS.text : scoreDelta > 0 ? COLORS.emerald : scoreDelta < 0 ? COLORS.red : COLORS.text

      ensureSpace(doc, 56)
      const boxY = doc.y
      const boxH = 48
      doc.roundedRect(doc.page.margins.left, boxY, contentWidth(doc), boxH, 6).fill(COLORS.softBg)
      doc.fillColor(COLORS.dim).font('Helvetica').fontSize(8)
      doc.text('BEFORE', doc.page.margins.left + 14, boxY + 10, { lineBreak: false })
      doc.text('AFTER', doc.page.margins.left + 120, boxY + 10, { lineBreak: false })
      if (scoreDelta != null) {
        doc.text('CHANGE', doc.page.margins.left + 230, boxY + 10, { lineBreak: false })
      }
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(20)
      doc.text(fromScore != null ? String(fromScore) : '—', doc.page.margins.left + 14, boxY + 22, {
        lineBreak: false,
      })
      doc.text(toScore != null ? String(toScore) : '—', doc.page.margins.left + 120, boxY + 22, {
        lineBreak: false,
      })
      if (scoreDelta != null) {
        const label = scoreDelta > 0 ? `+${scoreDelta}` : String(scoreDelta)
        doc.fillColor(scoreColor).text(`${label} pts`, doc.page.margins.left + 230, boxY + 22, {
          lineBreak: false,
        })
      }
      doc.y = boxY + boxH + 10
      doc.x = doc.page.margins.left

      // Profile metrics (exclude funding)
      const metricDeltas = deltas.filter((d) => d.field !== 'bureau_score')
      if (metricDeltas.length) {
        ensureSpace(doc, 24 + metricDeltas.length * 14)
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text('PROFILE METRICS')
        doc.moveDown(0.2)
        for (const d of metricDeltas) {
          ensureSpace(doc, 14)
          doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
          const left = `${d.label}: ${formatDeltaValue(d.from)} → ${formatDeltaValue(d.to)}`
          doc.text(left, { continued: true })
          doc.fillColor(directionColor(d.direction)).text(
            d.direction === 'unchanged' ? '  (same)' : `  (${d.direction})`
          )
        }
        doc.moveDown(0.35)
      }

      // Account changes
      const diff = accounts
      const hasAccounts =
        !!diff && (diff.removed.length > 0 || diff.added.length > 0 || diff.changed.length > 0)

      ensureSpace(doc, 28)
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text('ACCOUNT CHANGES')
      doc.moveDown(0.2)

      if (!hasAccounts) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.dim)
          .text(
            diff?.matchConfidence === 'low'
              ? 'Could not match accounts reliably between reports. Score change above still applies.'
              : 'No account-level changes detected for this bureau.'
          )
        doc.moveDown(0.6)
        continue
      }

      if (diff!.changed.length > 0) {
        ensureSpace(doc, 20)
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Updated accounts')
        doc.moveDown(0.15)
        for (const item of diff!.changed) {
          ensureSpace(doc, 28 + item.fields.length * 12)
          const mask = item.accountMask && item.accountMask !== '—' ? ` ${item.accountMask}` : ''
          doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text).text(`${item.creditor}${mask}`)
          for (const f of item.fields) {
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(COLORS.muted)
              .text(`  ${f.label}: ${f.from} → `, { continued: true })
            doc.fillColor(directionColor(f.direction === 'improved' ? 'improved' : f.direction === 'worsened' ? 'worsened' : 'unchanged')).text(f.to)
          }
          doc.moveDown(0.15)
        }
      }

      if (diff!.removed.length > 0) {
        ensureSpace(doc, 20 + diff!.removed.length * 11)
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.emerald).text('Removed from report')
        doc.moveDown(0.1)
        for (const item of diff!.removed) {
          const mask = item.accountMask && item.accountMask !== '—' ? ` ${item.accountMask}` : ''
          doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(`• ${item.creditor}${mask}`)
        }
        doc.moveDown(0.25)
      }

      if (diff!.added.length > 0) {
        ensureSpace(doc, 20 + diff!.added.length * 11)
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.amber).text('New on report')
        doc.moveDown(0.1)
        for (const item of diff!.added) {
          const mask = item.accountMask && item.accountMask !== '—' ? ` ${item.accountMask}` : ''
          doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(`• ${item.creditor}${mask}`)
        }
        doc.moveDown(0.25)
      }

      doc.moveDown(0.45)
    }

    ensureSpace(doc, 40)
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.dim)
      .text(
        'Disclaimer: Sunday Harmony provides credit education and dispute support. This document is not a FICO® Score, VantageScore®, credit counseling substitute, or guarantee of score improvement. Credit bureau data can differ across reports and may update on different schedules.',
        { width: contentWidth(doc) }
      )

    doc.end()
  })
}

/** Assemble PDF input from dispute sessions for a selected report. */
export function buildCreditRepairProgressPdfInput(params: {
  sessions: DisputeSessionListItem[]
  selectedSessionId: string
  compareMode?: CreditRepairCompareMode
  clientName?: string | null
}): CreditRepairProgressPdfInput | { error: string } {
  const progressByBureau = buildAllBureauProgress(params.sessions, params.selectedSessionId)
  const hasComparison = Object.values(progressByBureau).some(
    (p) => (p?.readyCount || 0) >= 2 && p?.current && p?.baseline
  )
  if (!hasComparison) {
    return {
      error:
        'Upload at least two ready reports for the same bureau to build a before/after credit progress PDF.',
    }
  }

  const selected = params.sessions.find((s) => s.id === params.selectedSessionId)
  const nameFromReport =
    selected?.intelligence_json?.consumer_name ||
    selected?.report_json?.credit_intelligence?.consumer_name ||
    selected?.report_json?.consumer?.name ||
    params.clientName ||
    'Client'

  const compareMode = params.compareMode || 'baseline'
  // Fall back to baseline when previous is unavailable
  const canPrevious = Object.values(progressByBureau).some(
    (p) => p?.previous && (p.vsPrevious?.length || 0) > 0
  )
  const mode: CreditRepairCompareMode =
    compareMode === 'previous' && canPrevious ? 'previous' : 'baseline'

  return {
    clientName: asText(nameFromReport, 'Client'),
    compareMode: mode,
    generatedAt: new Date().toISOString(),
    progressByBureau,
  }
}
