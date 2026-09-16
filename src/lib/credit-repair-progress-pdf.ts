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
  TradelineFieldChange,
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
  cardBg: '#f7f6f3',
  white: '#ffffff',
  emerald: '#047857',
  emeraldSoft: '#ecfdf5',
  red: '#991b1b',
  redSoft: '#fef2f2',
  amber: '#92400e',
  amberSoft: '#fffbeb',
}

const BUREAU_ORDER: BureauCode[] = ['TUC', 'EXP', 'EQF']

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

const PAGE_MARGINS = { top: 52, bottom: 56, left: 56, right: 56 }
const CARD_RADIUS = 8
const CARD_PAD = 14
const ACCOUNT_CARD_GAP = 14
const FIELD_ROW_H = 30

function contentWidth(doc: Doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function safe(value: unknown, fallback = ''): string {
  return pdfSafeText(asText(value, fallback))
}

/** Never pipe-separate mask dots — show a clean last-four suffix. */
export function formatAccountMaskForPdf(mask: string | null | undefined): string {
  const raw = (mask || '').trim()
  if (!raw || raw === '-' || raw === '—') return ''
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length >= 4) return `#${digits.slice(-4)}`
  if (digits.length > 0) return `#${digits}`
  return ''
}

function truncateFilename(name: string, max = 48): string {
  const cleaned = safe(name)
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 3)}...`
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
        safe(`Page ${pageNumber}  -  Credit Progress Report  -  Sunday Harmony`),
        doc.page.margins.left,
        doc.page.height - 34,
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

/** Vector arrow (Helvetica has no reliable Unicode arrow glyph). */
function drawArrow(doc: Doc, x1: number, y: number, x2: number, color = COLORS.dim) {
  const tip = 3.5
  doc.save()
  doc.strokeColor(color).lineWidth(1.1).lineCap('round').lineJoin('round')
  doc.moveTo(x1, y).lineTo(x2 - tip, y).stroke()
  doc.moveTo(x2 - tip, y - tip).lineTo(x2, y).lineTo(x2 - tip, y + tip).stroke()
  doc.restore()
}

function directionColor(direction: string): string {
  if (direction === 'improved') return COLORS.emerald
  if (direction === 'worsened') return COLORS.red
  return COLORS.text
}

function drawSectionTitle(doc: Doc, title: string) {
  doc.moveDown(0.35)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text).text(title)
  doc.moveDown(0.45)
}

function drawMutedCaption(doc: Doc, text: string) {
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.dim).text(safe(text), { lineGap: 4 })
}

function drawBeforeAfterRow(
  doc: Doc,
  label: string,
  from: string,
  to: string,
  direction: string
): void {
  const left = doc.page.margins.left + CARD_PAD
  const width = contentWidth(doc) - CARD_PAD * 2
  const labelW = 62
  const arrowW = 22
  const gap = 8
  const valueW = (width - labelW - arrowW - gap * 2) / 2
  const y = doc.y

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.dim)
  doc.text(safe(label), left, y, { width: labelW, lineBreak: false })

  const fromX = left + labelW
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
  doc.text(safe(from), fromX, y, { width: valueW, lineGap: 3 })

  const arrowX = fromX + valueW + gap
  drawArrow(doc, arrowX, y + 5, arrowX + arrowW, COLORS.border)

  const toX = arrowX + arrowW + gap
  doc.font('Helvetica').fontSize(9).fillColor(directionColor(direction))
  doc.text(safe(to), toX, y, { width: valueW, lineGap: 3 })

  doc.y = y + FIELD_ROW_H
  doc.x = doc.page.margins.left
}

function drawScoreHero(
  doc: Doc,
  fromScore: number | null,
  toScore: number | null,
  scoreDelta: number | null,
  scoreColor: string
) {
  const boxY = doc.y
  const boxH = 76
  const boxW = contentWidth(doc)
  doc.roundedRect(doc.page.margins.left, boxY, boxW, boxH, CARD_RADIUS).fill(COLORS.softBg)

  const col1 = doc.page.margins.left + 24
  const col2 = doc.page.margins.left + boxW * 0.38
  const col3 = doc.page.margins.left + boxW * 0.72
  const scoreY = boxY + 34

  doc.fillColor(COLORS.dim).font('Helvetica').fontSize(9)
  doc.text('Before', col1, boxY + 16, { lineBreak: false })
  doc.text('After', col2, boxY + 16, { lineBreak: false })
  if (scoreDelta != null) {
    doc.text('Change', col3, boxY + 16, { lineBreak: false })
  }

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(28)
  doc.text(fromScore != null ? String(fromScore) : '-', col1, scoreY, { lineBreak: false })
  doc.text(toScore != null ? String(toScore) : '-', col2, scoreY, { lineBreak: false })

  const arrowY = scoreY + 10
  drawArrow(doc, col1 + 52, arrowY, col2 - 12, COLORS.accent)

  if (scoreDelta != null) {
    const label = scoreDelta > 0 ? `+${scoreDelta}` : String(scoreDelta)
    doc.fillColor(scoreColor).font('Helvetica-Bold').fontSize(22)
    doc.text(safe(`${label} pts`), col3, scoreY + 2, { lineBreak: false })
  }

  doc.y = boxY + boxH + 22
  doc.x = doc.page.margins.left
}

function drawMetricPills(doc: Doc, deltas: CreditProgressDelta[]) {
  const changed = deltas.filter((d) => d.from !== d.to)
  if (!changed.length) return

  const pillGap = 10
  const pillW = (contentWidth(doc) - pillGap * (changed.length - 1)) / changed.length
  const pillH = 44
  ensureSpace(doc, pillH + 16)
  const y = doc.y

  changed.forEach((d, i) => {
    const x = doc.page.margins.left + i * (pillW + pillGap)
    doc.roundedRect(x, y, pillW, pillH, 6).fill(COLORS.cardBg)
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.dim)
    doc.text(safe(d.label), x + 10, y + 10, { width: pillW - 20, lineBreak: false })
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text)
    const from = formatDeltaValue(d.from)
    const to = formatDeltaValue(d.to)
    const midY = y + 24
    doc.text(from, x + 10, midY, { width: pillW * 0.38, lineBreak: false })
    drawArrow(doc, x + pillW * 0.42, midY + 4, x + pillW * 0.56, COLORS.border)
    doc.fillColor(directionColor(d.direction))
    doc.text(to, x + pillW * 0.58, midY, { width: pillW * 0.34, lineBreak: false })
  })

  doc.y = y + pillH + 20
  doc.x = doc.page.margins.left
}

function accountCardHeight(fieldCount: number): number {
  return CARD_PAD * 2 + 16 + fieldCount * FIELD_ROW_H
}

function drawAccountCard(
  doc: Doc,
  creditor: string,
  mask: string,
  fields: TradelineFieldChange['fields']
) {
  const cardH = accountCardHeight(fields.length)
  ensureSpace(doc, cardH + ACCOUNT_CARD_GAP)
  const x = doc.page.margins.left
  const w = contentWidth(doc)
  const y = doc.y

  doc.roundedRect(x, y, w, cardH, CARD_RADIUS).fillAndStroke(COLORS.white, COLORS.border)

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.text)
  const maskLabel = formatAccountMaskForPdf(mask)
  const title = maskLabel ? `${safe(creditor)}  ${maskLabel}` : safe(creditor)
  doc.text(title, x + CARD_PAD, y + CARD_PAD, { width: w - CARD_PAD * 2 })

  doc.y = y + CARD_PAD + 18
  doc.x = doc.page.margins.left
  for (const f of fields) {
    drawBeforeAfterRow(doc, f.label, f.from, f.to, f.direction)
  }

  doc.y = y + cardH + ACCOUNT_CARD_GAP
  doc.x = doc.page.margins.left
}

function drawSimpleAccountList(
  doc: Doc,
  items: { creditor: string; accountMask: string }[],
  title: string,
  titleColor: string
) {
  if (!items.length) return
  drawSectionTitle(doc, title)
  doc.font('Helvetica').fontSize(10).fillColor(titleColor)
  for (const item of items) {
    ensureSpace(doc, 20)
    const mask = formatAccountMaskForPdf(item.accountMask)
    const line = mask ? `${safe(item.creditor)}  ${mask}` : safe(item.creditor)
    doc.text(line, { lineGap: 6 })
    doc.moveDown(0.15)
  }
  doc.moveDown(0.35)
}

function scoreForBureau(
  report: CreditProgressReport,
  which: 'from' | 'to',
  compareMode: CreditRepairCompareMode
): number | null {
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

function drawReportRange(
  doc: Doc,
  fromSnap: CreditProgressReport['baseline'],
  toSnap: CreditProgressReport['current']
) {
  const fromLabel = safe(formatProgressDate(fromSnap?.reportDate || fromSnap?.createdAt))
  const toLabel = safe(formatProgressDate(toSnap?.reportDate || toSnap?.createdAt))
  drawMutedCaption(doc, `Before: ${fromLabel}`)
  drawMutedCaption(doc, `After: ${toLabel}`)
  const files = [fromSnap?.fileName, toSnap?.fileName]
    .filter(Boolean)
    .map((n) => truncateFilename(n!))
    .filter((n, i, all) => all.indexOf(n) === i)
  if (files.length) {
    doc.fontSize(8).fillColor(COLORS.dim).text(files.join('   /   '), { lineGap: 3 })
  }
  doc.moveDown(0.55)
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
      input.compareMode === 'previous' ? 'Previous report to current' : 'First report to current'
    const generated = safe(formatProgressDate(input.generatedAt || new Date().toISOString()))

    doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.text).text('Sunday Harmony')
    doc.moveDown(0.4)
    doc.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.accent).text('Credit Progress Report')
    doc.moveDown(0.55)
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.muted)
    doc.text(safe(`Prepared for ${client}`), { lineGap: 5 })
    doc.text(safe(`Comparison: ${compareLabel}`), { lineGap: 5 })
    doc.text(safe(`Generated ${generated}`), { lineGap: 5 })
    doc.moveDown(0.75)
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + contentWidth(doc), doc.y)
      .strokeColor(COLORS.border)
      .stroke()
    doc.moveDown(0.85)
    drawMutedCaption(
      doc,
      'Each following page compares one bureau from the earliest report on file to the latest report for that bureau.'
    )
    doc.moveDown(1)

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

      doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.text).text(BUREAU_LABELS[bureau])
      doc.moveDown(0.35)
      drawReportRange(doc, fromSnap, toSnap)

      const scoreDelta = fromScore != null && toScore != null ? toScore - fromScore : null
      const scoreColor =
        scoreDelta == null ? COLORS.text : scoreDelta > 0 ? COLORS.emerald : scoreDelta < 0 ? COLORS.red : COLORS.text

      drawScoreHero(doc, fromScore, toScore, scoreDelta, scoreColor)

      if (toScore == null && hasAccounts) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.amber)
          .text(
            safe('Score was not extracted from the newer report file. Account changes below still apply.'),
            { width: contentWidth(doc), lineGap: 4 }
          )
        doc.moveDown(0.5)
      }

      const metricDeltas = deltas.filter((d) => d.field !== 'bureau_score')
      if (metricDeltas.length) {
        drawSectionTitle(doc, 'Profile summary')
        drawMetricPills(doc, metricDeltas)
      }

      const diff = accounts
      drawSectionTitle(doc, 'Account changes')

      if (!hasAccounts) {
        drawMutedCaption(
          doc,
          diff?.matchConfidence === 'low'
            ? 'Could not match accounts between these two reports.'
            : 'No account-level changes for this bureau.'
        )
        doc.moveDown(0.5)
      } else {
        if (diff!.changed.length > 0) {
          doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted).text('Updated')
          doc.moveDown(0.5)
          for (const item of diff!.changed) {
            drawAccountCard(doc, item.creditor, item.accountMask, item.fields)
          }
        }

        drawSimpleAccountList(doc, diff!.removed, 'Removed from report', COLORS.emerald)
        drawSimpleAccountList(doc, diff!.added, 'New on report', COLORS.amber)
      }

      if (bureauIndex === bureaus.length - 1) {
        ensureSpace(doc, 48)
        doc.moveDown(0.5)
        drawMutedCaption(
          doc,
          'Educational progress tracking only. Not a credit score, funding decision, or legal advice.'
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
