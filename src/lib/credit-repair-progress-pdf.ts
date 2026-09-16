import PDFDocument from 'pdfkit'
import {
  buildAllBureauProgress,
  formatProgressDate,
} from '@/lib/dispute-letters/credit-progress'
import { asText, displayClientName, pdfSafeText } from '@/lib/credit-intelligence-pdf'
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

export function parseCreditRepairCompareMode(value: unknown): CreditRepairCompareMode {
  return value === 'previous' ? 'previous' : 'baseline'
}

type Doc = PDFKit.PDFDocument

const PAGE_MARGINS = { top: 56, bottom: 58, left: 54, right: 54 }
const SECTION_GAP = 0.55
const SUBSECTION_GAP = 0.35
const ITEM_GAP = 0.28

function contentWidth(doc: Doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function safe(value: unknown, fallback = ''): string {
  return pdfSafeText(asText(value, fallback))
}

function ensureSpace(doc: Doc, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (doc.y + needed > bottom) doc.addPage()
}

function startBureauPage(doc: Doc) {
  doc.addPage()
  doc.x = doc.page.margins.left
  doc.y = doc.page.margins.top
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
      .text(
        safe(`Page ${pageNumber} | Credit Progress Report | Sunday Harmony`),
        doc.page.margins.left,
        doc.page.height - 36,
        {
          width: contentWidth(doc),
          align: 'center',
          lineBreak: false,
        }
      )
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
  if (value == null || value === '') return '-'
  return safe(String(value))
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
      margins: PAGE_MARGINS,
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
      input.compareMode === 'previous' ? 'Previous report -> Current' : 'First report -> Current'
    const generated = safe(formatProgressDate(input.generatedAt || new Date().toISOString()))

    // Cover page
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.text).text('Sunday Harmony')
    doc.moveDown(0.35)
    doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.accent).text('Credit Progress Report')
    doc.moveDown(0.45)
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.muted)
    doc.text(safe(`Prepared for ${client}`), { lineGap: 4 })
    doc.text(safe(`Comparison: ${compareLabel}`), { lineGap: 4 })
    doc.text(safe(`Generated ${generated}`), { lineGap: 4 })
    doc.moveDown(0.65)
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + contentWidth(doc), doc.y)
      .strokeColor(COLORS.border)
      .stroke()
    doc.moveDown(0.75)

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(
        safe(
          'This report summarizes credit score movement and specific account-level changes between the compared credit reports. It is for educational progress tracking only and is not a credit score product, funding decision, or legal advice.'
        ),
        { width: contentWidth(doc), lineGap: 3 }
      )
    doc.moveDown(0.9)

    const bureaus = BUREAU_ORDER.filter((b) => {
      const report = input.progressByBureau[b]
      return report && report.readyCount >= 2 && report.current && report.baseline
    })

    if (bureaus.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor(COLORS.text).text('No comparable bureau reports are available yet.')
      doc.end()
      return
    }

    for (let bureauIndex = 0; bureauIndex < bureaus.length; bureauIndex += 1) {
      const bureau = bureaus[bureauIndex]
      const report = input.progressByBureau[bureau]!
      const fromScore = scoreForBureau(report, 'from', input.compareMode)
      const toScore = scoreForBureau(report, 'to', input.compareMode)
      const deltas = activeDeltas(report, input.compareMode)
      const accounts = activeAccountDiff(report, input.compareMode)
      const hasAccounts =
        !!accounts &&
        (accounts.removed.length > 0 || accounts.added.length > 0 || accounts.changed.length > 0)
      const fromSnap =
        input.compareMode === 'previous' && report.previous ? report.previous : report.baseline
      const toSnap = report.current

      startBureauPage(doc)

      doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.text).text(BUREAU_LABELS[bureau])
      doc.moveDown(0.25)
      const fromLabel = safe(formatProgressDate(fromSnap?.reportDate || fromSnap?.createdAt))
      const toLabel = safe(formatProgressDate(toSnap?.reportDate || toSnap?.createdAt))
      const fromFile = fromSnap?.fileName ? ` | ${safe(fromSnap.fileName)}` : ''
      const toFile = toSnap?.fileName ? ` | ${safe(toSnap.fileName)}` : ''
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.dim)
      doc.text(safe(`${fromLabel}${fromFile} -> ${toLabel}${toFile}`), { lineGap: 2 })
      doc.moveDown(SECTION_GAP)

      // Score hero row
      const scoreDelta =
        fromScore != null && toScore != null ? toScore - fromScore : null
      const scoreColor =
        scoreDelta == null ? COLORS.text : scoreDelta > 0 ? COLORS.emerald : scoreDelta < 0 ? COLORS.red : COLORS.text

      const boxY = doc.y
      const boxH = 62
      doc.roundedRect(doc.page.margins.left, boxY, contentWidth(doc), boxH, 8).fill(COLORS.softBg)
      doc.fillColor(COLORS.dim).font('Helvetica').fontSize(9)
      doc.text('BEFORE', doc.page.margins.left + 18, boxY + 14, { lineBreak: false })
      doc.text('AFTER', doc.page.margins.left + 140, boxY + 14, { lineBreak: false })
      if (scoreDelta != null) {
        doc.text('CHANGE', doc.page.margins.left + 270, boxY + 14, { lineBreak: false })
      }
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(24)
      doc.text(fromScore != null ? String(fromScore) : '-', doc.page.margins.left + 18, boxY + 30, {
        lineBreak: false,
      })
      doc.text(toScore != null ? String(toScore) : '-', doc.page.margins.left + 140, boxY + 30, {
        lineBreak: false,
      })
      if (toScore == null && hasAccounts) {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(COLORS.amber)
          .text(
            safe(
              'Score not found in the newer report file - account changes below still apply.'
            ),
            doc.page.margins.left + 18,
            boxY + boxH + 6,
            { width: contentWidth(doc) - 36, lineGap: 2 }
          )
        doc.y = Math.max(doc.y, boxY + boxH + 20)
      }
      if (scoreDelta != null) {
        const label = scoreDelta > 0 ? `+${scoreDelta}` : String(scoreDelta)
        doc.fillColor(scoreColor).text(safe(`${label} pts`), doc.page.margins.left + 270, boxY + 30, {
          lineBreak: false,
        })
      }
      doc.y = boxY + boxH + 18
      doc.x = doc.page.margins.left

      // Profile metrics (exclude funding)
      const metricDeltas = deltas.filter((d) => d.field !== 'bureau_score')
      if (metricDeltas.length) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted).text('PROFILE METRICS')
        doc.moveDown(SUBSECTION_GAP)
        for (const d of metricDeltas) {
          ensureSpace(doc, 18)
          doc.font('Helvetica').fontSize(10).fillColor(COLORS.text)
          const left = safe(`${d.label}: ${formatDeltaValue(d.from)} -> ${formatDeltaValue(d.to)}`)
          doc.text(left, { continued: true, lineGap: 2 })
          doc.fillColor(directionColor(d.direction)).text(
            d.direction === 'unchanged' ? '  (same)' : `  (${d.direction})`
          )
          doc.moveDown(0.12)
        }
        doc.moveDown(SECTION_GAP)
      }

      // Account changes
      const diff = accounts

      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted).text('ACCOUNT CHANGES')
      doc.moveDown(SUBSECTION_GAP)

      if (!hasAccounts) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(COLORS.dim)
          .text(
            safe(
              diff?.matchConfidence === 'low'
                ? 'Could not match accounts reliably between reports. Score change above still applies.'
                : 'No account-level changes detected for this bureau.'
            ),
            { lineGap: 2 }
          )
        doc.moveDown(SECTION_GAP)
      } else {
        if (diff!.changed.length > 0) {
          doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text).text('Updated accounts')
          doc.moveDown(SUBSECTION_GAP)
          for (const item of diff!.changed) {
            ensureSpace(doc, 36 + item.fields.length * 16)
            const mask =
              item.accountMask && item.accountMask !== '-' && item.accountMask !== '—'
                ? ` ${safe(item.accountMask)}`
                : ''
            doc
              .font('Helvetica-Bold')
              .fontSize(10)
              .fillColor(COLORS.text)
              .text(safe(`${item.creditor}${mask}`))
            doc.moveDown(0.1)
            for (const f of item.fields) {
              doc
                .font('Helvetica')
                .fontSize(9)
                .fillColor(COLORS.muted)
                .text(safe(`  ${f.label}: ${f.from} -> `), { continued: true })
              doc
                .fillColor(
                  directionColor(
                    f.direction === 'improved'
                      ? 'improved'
                      : f.direction === 'worsened'
                        ? 'worsened'
                        : 'unchanged'
                  )
                )
                .text(safe(f.to))
            }
            doc.moveDown(ITEM_GAP)
          }
          doc.moveDown(0.2)
        }

        if (diff!.removed.length > 0) {
          ensureSpace(doc, 24 + diff!.removed.length * 14)
          doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.emerald).text('Removed from report')
          doc.moveDown(SUBSECTION_GAP)
          for (const item of diff!.removed) {
            const mask =
              item.accountMask && item.accountMask !== '-' && item.accountMask !== '—'
                ? ` ${safe(item.accountMask)}`
                : ''
            doc
              .font('Helvetica')
              .fontSize(10)
              .fillColor(COLORS.text)
              .text(safe(`- ${item.creditor}${mask}`), { lineGap: 2 })
          }
          doc.moveDown(SECTION_GAP)
        }

        if (diff!.added.length > 0) {
          ensureSpace(doc, 24 + diff!.added.length * 14)
          doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.amber).text('New on report')
          doc.moveDown(SUBSECTION_GAP)
          for (const item of diff!.added) {
            const mask =
              item.accountMask && item.accountMask !== '-' && item.accountMask !== '—'
                ? ` ${safe(item.accountMask)}`
                : ''
            doc
              .font('Helvetica')
              .fontSize(10)
              .fillColor(COLORS.text)
              .text(safe(`- ${item.creditor}${mask}`), { lineGap: 2 })
          }
          doc.moveDown(SECTION_GAP)
        }
      }

      if (bureauIndex === bureaus.length - 1) {
        ensureSpace(doc, 52)
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(COLORS.dim)
          .text(
            safe(
              'Disclaimer: Sunday Harmony provides credit education and dispute support. This document is not a FICO Score, VantageScore, credit counseling substitute, or guarantee of score improvement. Credit bureau data can differ across reports and may update on different schedules.'
            ),
            { width: contentWidth(doc), lineGap: 2 }
          )
      }
    }

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
