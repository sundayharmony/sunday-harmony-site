import PDFDocument from 'pdfkit'
import {
  FACTOR_LABELS,
  type CreditIntelligenceReport,
  type FactorAnalysis,
  type Recommendation,
} from '@/lib/dispute-letters/types'

const COLORS = {
  text: '#0a0a0a',
  muted: '#5c5c5c',
  dim: '#8a8a8a',
  accent: '#b8943f',
  accentSoft: '#f0ebe3',
  border: '#e5e2dc',
  softBg: '#faf9f7',
  white: '#ffffff',
  emerald: '#047857',
  emeraldSoft: '#ecfdf5',
  sky: '#075985',
  skySoft: '#f0f9ff',
  amber: '#92400e',
  amberSoft: '#fffbeb',
  red: '#991b1b',
  redSoft: '#fef2f2',
  neutralSoft: '#f5f5f5',
}

type BandTone = {
  fill: string
  text: string
}

/** Strip aliases like "(also MIKE WEBB, ...)" for titles and filenames. */
export function displayClientName(raw: unknown, fallback = 'Client'): string {
  let name = asText(raw, fallback).trim()
  if (!name) return fallback
  name = name.replace(/\s*\((?:also|aka|a\.k\.a\.|also known as)\b[^)]*\)\s*/gi, ' ')
  name = name.replace(/\s*[-–—]\s*(?:also|aka|a\.k\.a\.)\b.*$/i, ' ')
  name = name.replace(/\s+/g, ' ').trim()
  return name || fallback
}

export function asText(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => asText(v)).filter((v) => v.length > 0)
}

function formatBand(band: unknown) {
  return asText(band).replace(/_/g, ' ')
}

function formatDateLabel(value?: string) {
  const raw = asText(value)
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function impactPct(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '0%'
  return `${Math.round(Math.min(1, Math.max(0, n)) * 100)}%`
}

/** Match CreditIntelligenceDashboard bandClass color mapping. */
export function bandTone(band: unknown): BandTone {
  const b = asText(band).toLowerCase().replace(/\s+/g, '_')
  if (
    b.includes('exceptional') ||
    b.includes('very_good') ||
    b === 'strong' ||
    b.includes('strong')
  ) {
    return { fill: COLORS.emeraldSoft, text: COLORS.emerald }
  }
  if (b.includes('good') || b === 'moderate' || b.includes('moderate')) {
    return { fill: COLORS.skySoft, text: COLORS.sky }
  }
  if (
    b.includes('fair') ||
    b.includes('mixed') ||
    b.includes('developing') ||
    b.includes('elevated')
  ) {
    return { fill: COLORS.amberSoft, text: COLORS.amber }
  }
  if (
    b.includes('poor') ||
    b.includes('weak') ||
    b.includes('limited') ||
    b.includes('severe')
  ) {
    return { fill: COLORS.redSoft, text: COLORS.red }
  }
  return { fill: COLORS.neutralSoft, text: COLORS.dim }
}

type Doc = PDFKit.PDFDocument

function contentWidth(doc: Doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function ensureSpace(doc: Doc, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (doc.y + needed > bottom) {
    doc.addPage()
  }
}

function drawFooter(doc: Doc, pageNumber: number) {
  const savedX = doc.x
  const savedY = doc.y
  const savedBottom = doc.page.margins.bottom
  // Writing in the margin must not trigger PDFKit's auto page-break (infinite pageAdded loop)
  doc.page.margins.bottom = 0
  try {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.dim)
      .text(`Page ${pageNumber}`, doc.page.margins.left, doc.page.height - 36, {
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

function drawSectionTitle(doc: Doc, title: string) {
  ensureSpace(doc, 32)
  doc.moveDown(0.45)
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text).text(title)
  const y = doc.y + 3
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(COLORS.accent)
    .lineWidth(1.25)
    .stroke()
  doc.y = y + 10
  doc.x = doc.page.margins.left
}

function drawPill(
  doc: Doc,
  label: string,
  tone: BandTone,
  x: number,
  y: number,
  opts?: { fontSize?: number; padX?: number; padY?: number }
) {
  const fontSize = opts?.fontSize ?? 9
  const padX = opts?.padX ?? 10
  const padY = opts?.padY ?? 4
  doc.font('Helvetica-Bold').fontSize(fontSize)
  const textW = doc.widthOfString(label)
  const w = textW + padX * 2
  const h = fontSize + padY * 2
  doc.roundedRect(x, y, w, h, 4).fill(tone.fill)
  doc
    .fillColor(tone.text)
    .text(label, x + padX, y + padY, { width: textW + 2, lineBreak: false })
  return { width: w, height: h }
}

function drawTintedPanel(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  title: string,
  items: string[],
  tone: BandTone
) {
  const pad = 10
  doc.font('Helvetica-Bold').fontSize(10)
  const titleH = doc.heightOfString(title, { width: width - pad * 2 })
  doc.font('Helvetica').fontSize(9)
  const lines = items.length ? items : ['None noted.']
  let bodyH = 0
  for (const item of lines) {
    bodyH += doc.heightOfString(`- ${item}`, { width: width - pad * 2 }) + 3
  }
  const boxH = pad + titleH + 6 + bodyH + pad

  doc.roundedRect(x, y, width, boxH, 6).fillAndStroke(tone.fill, COLORS.border)
  let cursor = y + pad
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(tone.text)
    .text(title, x + pad, cursor, { width: width - pad * 2 })
  cursor = doc.y + 4
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
  for (const item of lines) {
    doc.text(`- ${item}`, x + pad, cursor, { width: width - pad * 2 })
    cursor = doc.y + 3
  }
  return boxH
}

function drawFactorCard(doc: Doc, factor: FactorAnalysis) {
  const label = asText(FACTOR_LABELS[factor.factor] || factor.factor, 'Factor')
  const band = formatBand(factor.score_band).toUpperCase() || 'UNKNOWN'
  const tone = bandTone(factor.score_band)
  const summary = asText(factor.summary)
  const left = doc.page.margins.left
  const width = contentWidth(doc)
  const pad = 12

  doc.font('Helvetica-Bold').fontSize(11)
  const titleH = doc.heightOfString(label, { width: width - pad * 2 - 90 })
  doc.font('Helvetica').fontSize(9.5)
  const bodyH = summary ? doc.heightOfString(summary, { width: width - pad * 2 }) : 0
  const boxH = pad + Math.max(titleH, 16) + 8 + bodyH + pad

  ensureSpace(doc, boxH + 8)
  const startY = doc.y

  doc.roundedRect(left, startY, width, boxH, 6).fillAndStroke(COLORS.softBg, COLORS.border)
  // Left accent bar by band
  doc.rect(left, startY, 4, boxH).fill(tone.text)

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(label, left + pad, startY + pad, { width: width - pad * 2 - 90 })

  drawPill(doc, band, tone, left + width - pad - 78, startY + pad, {
    fontSize: 8,
    padX: 8,
    padY: 3,
  })

  if (summary) {
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text(summary, left + pad, startY + pad + Math.max(titleH, 16) + 6, {
        width: width - pad * 2,
      })
  }

  doc.y = startY + boxH + 8
  doc.x = left
}

function drawRecommendation(doc: Doc, rec: Recommendation) {
  const title = asText(rec.title, 'Recommendation')
  const rationale = asText(rec.rationale)
  const actions = asTextList(rec.suggested_actions).slice(0, 4)
  const left = doc.page.margins.left
  const width = contentWidth(doc)
  const pad = 12

  doc.font('Helvetica-Bold').fontSize(10.5)
  const titleH = doc.heightOfString(title, { width: width - pad * 2 })
  doc.font('Helvetica').fontSize(9)
  const metaH = 16
  const rationaleH = rationale ? doc.heightOfString(rationale, { width: width - pad * 2 }) : 0
  let actionsH = 0
  for (const a of actions) {
    actionsH += doc.heightOfString(`- ${a}`, { width: width - pad * 2 }) + 2
  }
  const boxH = pad + titleH + 6 + metaH + rationaleH + (actionsH ? 6 + actionsH : 0) + pad

  ensureSpace(doc, boxH + 8)
  const startY = doc.y
  doc.roundedRect(left, startY, width, boxH, 6).fillAndStroke(COLORS.white, COLORS.border)

  let cursor = startY + pad
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor(COLORS.text)
    .text(title, left + pad, cursor, { width: width - pad * 2 })
  cursor = doc.y + 6

  const impactLabel = `Impact ${impactPct(rec.estimated_impact)}`
  const confLabel = `Confidence ${impactPct(rec.confidence)}`
  const impactPill = drawPill(doc, impactLabel, bandTone('good'), left + pad, cursor, {
    fontSize: 8,
    padX: 7,
    padY: 3,
  })
  drawPill(doc, confLabel, { fill: COLORS.accentSoft, text: COLORS.accent }, left + pad + impactPill.width + 6, cursor, {
    fontSize: 8,
    padX: 7,
    padY: 3,
  })
  cursor += impactPill.height + 6

  if (rationale) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(rationale, left + pad, cursor, { width: width - pad * 2 })
    cursor = doc.y + 4
  }

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
  for (const action of actions) {
    doc.text(`- ${action}`, left + pad, cursor, { width: width - pad * 2 })
    cursor = doc.y + 2
  }

  doc.y = startY + boxH + 8
  doc.x = left
}

/** Render Credit Intelligence as a PDF buffer using PDFKit (no React). */
export async function buildCreditIntelligencePdfBuffer(
  report: CreditIntelligenceReport
): Promise<Buffer> {
  const overall = report.overall
  const funding = report.funding_readiness
  const consumerName = displayClientName(report.consumer_name)
  const strengths = asTextList(overall?.strengths).slice(0, 8)
  const weaknesses = [...asTextList(overall?.weaknesses), ...asTextList(overall?.risk_factors)].slice(
    0,
    8
  )
  const narrative = asText(overall?.narrative)
  const averageScore =
    typeof overall?.average_score === 'number' ? overall.average_score : null
  const blockers = asTextList(funding?.blockers).slice(0, 8)
  const supportive = asTextList(funding?.supportive_signals).slice(0, 8)
  const practical = asTextList(funding?.practical_steps).slice(0, 6)
  const nextSteps = asTextList(report.recommended_next_steps)
  const factors = Array.isArray(report.factors) ? report.factors : []
  const recommendations = Array.isArray(report.recommendations)
    ? report.recommendations.slice(0, 10)
    : []

  const metaLine = [
    report.report_date ? `Report ${asText(report.report_date)}` : '',
    report.analyzed_at ? `Analyzed ${formatDateLabel(report.analyzed_at)}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ')

  const bandLabel = formatBand(overall?.band)
  const overallTone = bandTone(overall?.band)
  const fundingTone = bandTone(funding?.level)
  const heroPill = `${bandLabel}${averageScore != null ? `  ·  ~${averageScore}` : ''}`.toUpperCase()

  return new Promise<Buffer>((resolve, reject) => {
    let pageNumber = 1
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 48, bottom: 52, left: 48, right: 48 },
      info: {
        Title: `${consumerName} — Credit Analysis`,
        Author: 'Sunday Harmony',
        Subject: 'Credit Analysis',
        Creator: 'Sunday Harmony Credit Intelligence',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Draw footer as pages are created — avoids blank trailing pages from switchToPage
    drawFooter(doc, pageNumber)
    doc.on('pageAdded', () => {
      pageNumber += 1
      drawFooter(doc, pageNumber)
    })

    const left = doc.page.margins.left
    const width = contentWidth(doc)

    // —— Header ——
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.accent).text('Sunday Harmony')
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.text).text('Credit Analysis')
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.text).text(consumerName)
    if (metaLine) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(metaLine)
    }

    const headerLineY = doc.y + 8
    doc
      .moveTo(left, headerLineY)
      .lineTo(left + width, headerLineY)
      .strokeColor(COLORS.accent)
      .lineWidth(2.5)
      .stroke()
    doc.y = headerLineY + 16
    doc.x = left

    // —— Hero score card ——
    ensureSpace(doc, 70)
    const heroY = doc.y
    const heroH = narrative ? 62 : 44
    doc.roundedRect(left, heroY, width, heroH, 8).fillAndStroke(overallTone.fill, COLORS.border)
    drawPill(doc, heroPill, overallTone, left + 14, heroY + 12, {
      fontSize: 11,
      padX: 12,
      padY: 5,
    })
    if (narrative) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(narrative, left + 14, heroY + 36, { width: width - 28, lineGap: 1 })
    }
    doc.y = heroY + heroH + 14
    doc.x = left

    // —— Strengths & Risks ——
    drawSectionTitle(doc, 'Strengths & Risks')
    const colGap = 12
    const colW = (width - colGap) / 2
    const panelY = doc.y
    const leftH = drawTintedPanel(
      doc,
      left,
      panelY,
      colW,
      'Strengths',
      strengths,
      { fill: COLORS.emeraldSoft, text: COLORS.emerald }
    )
    const rightH = drawTintedPanel(
      doc,
      left + colW + colGap,
      panelY,
      colW,
      'Weaknesses & risks',
      weaknesses,
      { fill: COLORS.amberSoft, text: COLORS.amber }
    )
    doc.y = panelY + Math.max(leftH, rightH) + 10
    doc.x = left

    // —— Funding readiness ——
    drawSectionTitle(doc, 'Funding Readiness')
    const fundTitle = `${formatBand(funding?.level)}  ·  ${asText(funding?.score_0_to_100, '0')}/100`
    const fundSummary = asText(funding?.summary)
    doc.font('Helvetica-Bold').fontSize(11)
    const fundTitleH = 22
    doc.font('Helvetica').fontSize(9.5)
    const fundBodyH = fundSummary
      ? doc.heightOfString(fundSummary, { width: width - 28 })
      : 0
    const fundBoxH = 14 + fundTitleH + fundBodyH + 14
    ensureSpace(doc, fundBoxH + 8)
    const fundY = doc.y
    doc.roundedRect(left, fundY, width, fundBoxH, 8).fillAndStroke(fundingTone.fill, COLORS.border)
    drawPill(doc, fundTitle.toUpperCase(), fundingTone, left + 14, fundY + 12, {
      fontSize: 9,
      padX: 10,
      padY: 4,
    })
    if (fundSummary) {
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(COLORS.muted)
        .text(fundSummary, left + 14, fundY + 12 + fundTitleH, { width: width - 28 })
    }
    doc.y = fundY + fundBoxH + 10
    doc.x = left

    const fundColY = doc.y
    const blockH = drawTintedPanel(
      doc,
      left,
      fundColY,
      colW,
      'Blockers',
      blockers.length ? blockers : ['None flagged from available data.'],
      { fill: COLORS.redSoft, text: COLORS.red }
    )
    const supportH = drawTintedPanel(
      doc,
      left + colW + colGap,
      fundColY,
      colW,
      'Supportive signals',
      supportive.length ? supportive : ['Limited supportive signals in current extract.'],
      { fill: COLORS.skySoft, text: COLORS.sky }
    )
    doc.y = fundColY + Math.max(blockH, supportH) + 8
    doc.x = left

    if (practical.length) {
      ensureSpace(doc, 40)
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Practical next steps')
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
      for (const step of practical) {
        ensureSpace(doc, 14)
        doc.text(`- ${step}`, { width })
      }
      doc.moveDown(0.3)
    }

    // —— Factor analysis ——
    drawSectionTitle(doc, 'Factor Analysis')
    for (const factor of factors) {
      drawFactorCard(doc, factor)
    }

    // —— Recommendations ——
    drawSectionTitle(doc, 'Prioritized Recommendations')
    if (!recommendations.length) {
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('No recommendations generated.')
    } else {
      for (const rec of recommendations) {
        drawRecommendation(doc, rec)
      }
    }

    if (nextSteps.length) {
      drawSectionTitle(doc, 'Recommended Next Steps')
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.text)
      nextSteps.forEach((step, index) => {
        ensureSpace(doc, 16)
        doc.text(`${index + 1}. ${step}`, { width })
      })
    }

    // —— Disclaimer ——
    ensureSpace(doc, 48)
    doc.moveDown(0.6)
    const discY = doc.y
    doc
      .moveTo(left, discY)
      .lineTo(left + width, discY)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke()
    doc.y = discY + 8
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.dim)
      .text(
        asText(
          report.disclaimer,
          'Educational analysis only. Not a credit score calculation, credit counseling substitute, or legal advice. Does not guarantee score changes, deletions, or financing approval.'
        ),
        { width, lineGap: 1.5 }
      )

    doc.end()
  })
}

/** Count /Page objects for smoke tests (approximate page count). */
export function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString('latin1')
  const matches = text.match(/\/Type\s*\/Page(?!s)\b/g)
  return matches?.length ?? 0
}
