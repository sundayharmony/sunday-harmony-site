import PDFDocument from 'pdfkit'
import {
  FACTOR_LABELS,
  type CreditIntelligenceReport,
  type FactorAnalysis,
  type Recommendation,
} from '@/lib/dispute-letters/types'

const COLORS = {
  text: '#1a1a1a',
  muted: '#5c5c5c',
  dim: '#8a8a8a',
  accent: '#b8943f',
  border: '#e5e2dc',
  softBg: '#faf9f7',
}

function asText(value: unknown, fallback = ''): string {
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

type Doc = PDFKit.PDFDocument

function ensureSpace(doc: Doc, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (doc.y + needed > bottom) {
    doc.addPage()
  }
}

function drawSectionTitle(doc: Doc, title: string) {
  ensureSpace(doc, 28)
  doc.moveDown(0.6)
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(title)
  const y = doc.y + 2
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke()
  doc.moveDown(0.5)
}

function drawBullets(doc: Doc, items: string[], limit = 8) {
  const list = asTextList(items).slice(0, limit)
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
  if (!list.length) {
    ensureSpace(doc, 16)
    doc.text('None noted.')
    return
  }
  for (const item of list) {
    ensureSpace(doc, 16)
    doc.text(`- ${item}`, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right })
  }
}

function drawCard(doc: Doc, title: string, body: string, meta?: string) {
  ensureSpace(doc, 54)
  const left = doc.page.margins.left
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const startY = doc.y

  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text)
  const titleHeight = doc.heightOfString(title, { width: width - 16 })
  doc.font('Helvetica').fontSize(10)
  const bodyHeight = body ? doc.heightOfString(body, { width: width - 16 }) : 0
  const metaHeight = meta ? 12 : 0
  const boxHeight = 16 + titleHeight + metaHeight + bodyHeight + 10

  doc
    .roundedRect(left, startY, width, boxHeight, 4)
    .fillAndStroke(COLORS.softBg, COLORS.border)

  let cursor = startY + 8
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(title, left + 8, cursor, { width: width - 16 })
  cursor = doc.y + 2
  if (meta) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(COLORS.accent)
      .text(meta, left + 8, cursor, { width: width - 16 })
    cursor = doc.y + 2
  }
  if (body) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(body, left + 8, cursor, { width: width - 16 })
  }
  doc.y = startY + boxHeight + 8
  doc.x = left
}

function drawFactor(doc: Doc, factor: FactorAnalysis) {
  const label = asText(FACTOR_LABELS[factor.factor] || factor.factor, 'Factor')
  drawCard(doc, label, asText(factor.summary), formatBand(factor.score_band).toUpperCase())
}

function drawRecommendation(doc: Doc, rec: Recommendation) {
  ensureSpace(doc, 60)
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(asText(rec.title, 'Recommendation'))
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.dim)
    .text(
      `Impact ${impactPct(rec.estimated_impact)} / Confidence ${impactPct(rec.confidence)}`
    )
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(asText(rec.rationale))
  for (const action of asTextList(rec.suggested_actions).slice(0, 4)) {
    ensureSpace(doc, 14)
    doc.text(`- ${action}`)
  }
  doc.moveDown(0.4)
  const y = doc.y
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke()
  doc.moveDown(0.5)
}

/** Render Credit Intelligence as a PDF buffer using PDFKit (no React). */
export async function buildCreditIntelligencePdfBuffer(
  report: CreditIntelligenceReport
): Promise<Buffer> {
  const overall = report.overall
  const funding = report.funding_readiness
  const consumerName = asText(report.consumer_name, 'Client')
  const strengths = asTextList(overall?.strengths)
  const weaknesses = [...asTextList(overall?.weaknesses), ...asTextList(overall?.risk_factors)]
  const narrative = asText(overall?.narrative)
  const averageScore =
    typeof overall?.average_score === 'number' ? overall.average_score : null
  const blockers = asTextList(funding?.blockers)
  const supportive = asTextList(funding?.supportive_signals)
  const practical = asTextList(funding?.practical_steps)
  const nextSteps = asTextList(report.recommended_next_steps)
  const factors = Array.isArray(report.factors) ? report.factors : []
  const recommendations = Array.isArray(report.recommendations)
    ? report.recommendations.slice(0, 10)
    : []

  const metaParts = [
    consumerName,
    report.report_date ? `Report ${asText(report.report_date)}` : '',
    report.analyzed_at ? `Analyzed ${formatDateLabel(report.analyzed_at)}` : '',
  ].filter(Boolean)

  const bandLabel = formatBand(overall?.band)
  const scoreSuffix = averageScore != null ? `  /  ~${averageScore}` : ''

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      bufferPages: true,
      margins: { top: 48, bottom: 52, left: 48, right: 48 },
      info: {
        Title: `Credit Profile Analysis - ${consumerName}`,
        Author: 'Sunday Harmony',
        Subject: 'Credit Profile Analysis',
        Creator: 'Sunday Harmony Credit Intelligence',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right

    // Header
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(COLORS.accent)
      .text('Sunday Harmony')
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(COLORS.text)
      .text('Credit Profile Analysis')
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(metaParts.join('  |  '))

    const headerLineY = doc.y + 6
    doc
      .moveTo(doc.page.margins.left, headerLineY)
      .lineTo(doc.page.width - doc.page.margins.right, headerLineY)
      .strokeColor(COLORS.accent)
      .lineWidth(2)
      .stroke()
    doc.y = headerLineY + 14

    // Band pill
    const pill = `${bandLabel}${scoreSuffix}`.toUpperCase()
    doc.font('Helvetica-Bold').fontSize(9)
    const pillWidth = Math.min(pageWidth(), doc.widthOfString(pill) + 16)
    const pillHeight = 16
    doc
      .roundedRect(doc.page.margins.left, doc.y, pillWidth, pillHeight, 3)
      .fill('#f0ebe3')
    doc
      .fillColor(COLORS.accent)
      .text(pill, doc.page.margins.left + 8, doc.y + 4, { width: pillWidth - 16, lineBreak: false })
    doc.y += pillHeight + 10
    doc.x = doc.page.margins.left

    if (narrative) {
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(narrative, {
        width: pageWidth(),
        lineGap: 2,
      })
      doc.moveDown(0.4)
    }

    // Strengths & Risks
    drawSectionTitle(doc, 'Strengths & Risks')
    const colGap = 16
    const colWidth = (pageWidth() - colGap) / 2
    const leftX = doc.page.margins.left
    const rightX = leftX + colWidth + colGap
    const topY = doc.y

    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Strengths', leftX, topY, {
      width: colWidth,
    })
    const leftAfterTitle = doc.y
    doc.text('Weaknesses & risks', rightX, topY, { width: colWidth })
    const rightAfterTitle = doc.y

    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
    let leftY = Math.max(leftAfterTitle, rightAfterTitle) + 4
    let rightY = leftY

    const leftItems = strengths.length ? strengths.slice(0, 8) : ['None noted.']
    const rightItems = weaknesses.length ? weaknesses.slice(0, 8) : ['None noted.']

    for (const item of leftItems) {
      doc.text(`- ${item}`, leftX, leftY, { width: colWidth })
      leftY = doc.y + 2
    }
    for (const item of rightItems) {
      doc.text(`- ${item}`, rightX, rightY, { width: colWidth })
      rightY = doc.y + 2
    }
    doc.y = Math.max(leftY, rightY) + 6
    doc.x = leftX

    // Funding readiness
    drawSectionTitle(doc, 'Funding Readiness')
    drawCard(
      doc,
      `${formatBand(funding?.level)} / ${asText(funding?.score_0_to_100, '0')}/100`,
      asText(funding?.summary)
    )

    const fundTop = doc.y
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Blockers', leftX, fundTop, {
      width: colWidth,
    })
    const blockersTitleY = doc.y
    doc.text('Supportive signals', rightX, fundTop, { width: colWidth })
    const signalsTitleY = doc.y
    let bY = Math.max(blockersTitleY, signalsTitleY) + 4
    let sY = bY
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
    const blockerItems = blockers.length ? blockers.slice(0, 8) : ['None flagged from available data.']
    const signalItems = supportive.length
      ? supportive.slice(0, 8)
      : ['Limited supportive signals in current extract.']
    for (const item of blockerItems) {
      doc.text(`- ${item}`, leftX, bY, { width: colWidth })
      bY = doc.y + 2
    }
    for (const item of signalItems) {
      doc.text(`- ${item}`, rightX, sY, { width: colWidth })
      sY = doc.y + 2
    }
    doc.y = Math.max(bY, sY) + 6
    doc.x = leftX

    if (practical.length) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Practical next steps')
      drawBullets(doc, practical, 6)
    }

    // Factors
    drawSectionTitle(doc, 'Factor Analysis')
    for (const factor of factors) {
      drawFactor(doc, factor)
    }

    // Recommendations
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
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
      nextSteps.forEach((step, index) => {
        ensureSpace(doc, 16)
        doc.text(`${index + 1}. ${step}`)
      })
    }

    // Disclaimer
    ensureSpace(doc, 40)
    doc.moveDown(0.8)
    const discY = doc.y
    doc
      .moveTo(doc.page.margins.left, discY)
      .lineTo(doc.page.width - doc.page.margins.right, discY)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke()
    doc.moveDown(0.5)
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.dim)
      .text(
        asText(
          report.disclaimer,
          'Educational analysis only. Not a credit score calculation, credit counseling substitute, or legal advice. Does not guarantee score changes, deletions, or financing approval.'
        ),
        { width: pageWidth(), lineGap: 1.5 }
      )

    // Simple page numbers via outline after end is hard with PDFKit stream;
    // stamp current page count in footer on each page switch.
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i)
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.dim)
        .text(`Page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 36, {
          width: pageWidth(),
          align: 'center',
          lineBreak: false,
        })
    }

    doc.end()
  })
}
