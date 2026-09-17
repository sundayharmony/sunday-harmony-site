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
  'inquiry_count',
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

const PAGE_MARGINS = { top: 26, bottom: 26, left: 56, right: 56 }
const CARD_RADIUS = 8
const CARD_PAD = 5
const ACCOUNT_CARD_GAP = 6
/** Horizontal gutter between account cards when they are laid out in columns. */
const CARD_COLUMN_GAP = 10
const TITLE_ROW_H = 10
/** Field rows keep the same footprint: taller gap, shorter text block. */
const FIELD_TEXT_H = 10
const FIELD_ROW_GAP = 5
const FIELD_ROW_H = FIELD_TEXT_H + FIELD_ROW_GAP
const FIELD_LABEL_W = 56
/** Below this card width the field rows switch to their compact metrics. */
const NARROW_CARD_W = 300
const HERO_H = 62
const PILL_H = 32
const PILL_ROW_GAP = 6
/**
 * Breathing room kept below the last block on a page. PDFKit starts a new page
 * as soon as a text line would cross the bottom margin, so absolute layouts
 * must stop short of it.
 */
const SECTION_BOTTOM_INSET = 8

function contentWidth(doc: Doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function sectionHeight(doc: Doc) {
  return doc.page.height - PAGE_MARGINS.top - PAGE_MARGINS.bottom - SECTION_BOTTOM_INSET
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

/** Trim to the widest prefix that fits, measured with the caller's current font. */
export function truncateToWidth(
  text: string,
  width: number,
  measure: (value: string) => number
): string {
  if (!text || width <= 0) return ''
  if (measure(text) <= width) return text
  const ellipsis = '...'
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(text.slice(0, mid) + ellipsis) <= width) lo = mid
    else hi = mid - 1
  }
  if (lo <= 0) return ''
  return `${text.slice(0, lo).trimEnd()}${ellipsis}`
}

function fitText(doc: Doc, value: unknown, width: number): string {
  return truncateToWidth(safe(value), width, (s) => doc.widthOfString(s))
}

function lineHeightOf(doc: Doc, font: string, size: number): number {
  doc.font(font).fontSize(size)
  return doc.currentLineHeight(false)
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
        doc.page.height - 18,
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

function drawMutedCaption(doc: Doc, text: string) {
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.dim).text(safe(text), { lineGap: 4 })
}

/* ------------------------------------------------------------------ *
 * Layout engine
 *
 * A bureau section is described as an ordered list of blocks with
 * measurable heights before anything is drawn. That lets us pick the
 * account-card column count, split the section across pages evenly and
 * spread leftover space into the gaps — all from one set of heights.
 * ------------------------------------------------------------------ */

export type ElasticItem = { weight: number; max: number }

/**
 * Hand out `slack` between elastic items proportionally to their weight,
 * never giving any single item more than its `max`.
 */
export function distributeSlack(items: ElasticItem[], slack: number): number[] {
  const out = items.map(() => 0)
  let remaining = Math.max(0, slack)
  if (remaining <= 0) return out

  let active = items
    .map((item, index) => (item.weight > 0 && item.max > 0 ? index : -1))
    .filter((index) => index >= 0)

  for (let pass = 0; pass < 6 && remaining > 0.01 && active.length > 0; pass += 1) {
    const totalWeight = active.reduce((sum, index) => sum + items[index].weight, 0)
    if (totalWeight <= 0) break
    const pool = remaining
    let used = 0
    const next: number[] = []
    for (const index of active) {
      const want = (pool * items[index].weight) / totalWeight
      const room = items[index].max - out[index]
      const give = Math.min(want, room)
      out[index] += give
      used += give
      if (room - give > 0.01) next.push(index)
    }
    remaining -= used
    active = next
    if (used <= 0.01) break
  }

  return out
}

export type PackItem = {
  height: number
  gapAfter: number
  /** Block may not be separated from the following block by a page break. */
  keepWithNext?: boolean
}

type Atom = { indexes: number[]; height: number; gapAfter: number }

function toAtoms(items: PackItem[]): Atom[] {
  const atoms: Atom[] = []
  let start = 0
  while (start < items.length) {
    let end = start
    let height = items[start].height
    while (items[end].keepWithNext && end + 1 < items.length) {
      height += items[end].gapAfter + items[end + 1].height
      end += 1
    }
    const indexes: number[] = []
    for (let i = start; i <= end; i += 1) indexes.push(i)
    atoms.push({ indexes, height, gapAfter: items[end].gapAfter })
    start = end + 1
  }
  return atoms
}

function packAtoms(atoms: Atom[], limit: number): Atom[][] {
  const pages: Atom[][] = []
  let current: Atom[] = []
  let used = 0
  for (const atom of atoms) {
    if (current.length === 0) {
      current = [atom]
      used = atom.height
      continue
    }
    const gap = current[current.length - 1].gapAfter
    if (used + gap + atom.height > limit) {
      pages.push(current)
      current = [atom]
      used = atom.height
    } else {
      used += gap + atom.height
      current.push(atom)
    }
  }
  if (current.length > 0) pages.push(current)
  return pages
}

/**
 * Fill each page towards an even share of what is left rather than to the
 * brim, so the final page of a section is never left nearly empty.
 */
function packAtomsBalanced(atoms: Atom[], limit: number, pageCount: number): Atom[][] {
  const pages: Atom[][] = []
  let remaining = atoms.reduce(
    (sum, atom, index) => sum + atom.height + (index < atoms.length - 1 ? atom.gapAfter : 0),
    0
  )
  let remainingPages = pageCount
  let index = 0

  while (index < atoms.length) {
    const isLast = remainingPages <= 1
    const target = isLast ? limit : remaining / remainingPages
    const page: Atom[] = []
    let used = 0
    while (index < atoms.length) {
      const gap = page.length > 0 ? atoms[index - 1].gapAfter : 0
      const next = used + gap + atoms[index].height
      if (page.length > 0 && next > limit) break
      // Stop once the page is closer to its share without the next atom.
      if (page.length > 0 && !isLast && Math.abs(next - target) > Math.abs(used - target)) break
      page.push(atoms[index])
      used = next
      index += 1
    }
    pages.push(page)
    remaining -= used + (index < atoms.length ? atoms[index - 1].gapAfter : 0)
    remainingPages -= 1
  }

  return pages
}

/**
 * Split blocks into pages using the fewest pages possible, then even out the
 * fill across those pages.
 */
export function packSectionPages(items: PackItem[], pageHeight: number): number[][] {
  if (items.length === 0) return []
  const atoms = toAtoms(items)
  const expand = (pages: Atom[][]) => pages.map((page) => page.flatMap((atom) => atom.indexes))

  const tight = packAtoms(atoms, pageHeight)
  if (tight.length <= 1) return expand(tight)

  const balanced = packAtomsBalanced(atoms, pageHeight, tight.length)
  return expand(balanced.length === tight.length ? balanced : tight)
}

type SectionBlock = {
  height: number
  /** Weight for absorbing leftover page space into the block itself. */
  grow: number
  growMax: number
  gap: number
  /** Weight for absorbing leftover page space into the gap that follows. */
  gapGrow: number
  gapGrowMax: number
  keepWithNext: boolean
  draw: (y: number, height: number) => void
}

type BlockSpec = {
  height: number
  draw: (y: number, height: number) => void
  grow?: number
  growMax?: number
  gap?: number
  gapGrow?: number
  gapGrowMax?: number
  keepWithNext?: boolean
}

function block(spec: BlockSpec): SectionBlock {
  return {
    height: spec.height,
    grow: spec.grow ?? 0,
    growMax: spec.growMax ?? 0,
    gap: spec.gap ?? 0,
    gapGrow: spec.gapGrow ?? 0,
    gapGrowMax: spec.gapGrowMax ?? 0,
    keepWithNext: spec.keepWithNext ?? false,
    draw: spec.draw,
  }
}

/** Widen the gap that leads into the next section heading. */
function openSectionGap(blocks: SectionBlock[], gap: number, grow: number, growMax: number) {
  const last = blocks[blocks.length - 1]
  if (!last) return
  last.gap = gap
  last.gapGrow = grow
  last.gapGrowMax = growMax
}

function drawBlockPage(doc: Doc, blocks: SectionBlock[], top: number, pageHeight: number) {
  const natural = blocks.reduce(
    (sum, b, index) => sum + b.height + (index < blocks.length - 1 ? b.gap : 0),
    0
  )
  const elastics: ElasticItem[] = []
  blocks.forEach((b, index) => {
    elastics.push({ weight: b.grow, max: b.growMax })
    if (index < blocks.length - 1) elastics.push({ weight: b.gapGrow, max: b.gapGrowMax })
  })
  const extra = distributeSlack(elastics, pageHeight - natural)

  let y = top
  blocks.forEach((b, index) => {
    const height = b.height + extra[index * 2]
    b.draw(y, height)
    y += height
    if (index < blocks.length - 1) y += b.gap + extra[index * 2 + 1]
  })
}

/** Each bureau section owns its pages, so every page starts at the top margin. */
function renderSection(doc: Doc, blocks: SectionBlock[]) {
  const pageHeight = sectionHeight(doc)
  const pages = packSectionPages(
    blocks.map((b) => ({ height: b.height, gapAfter: b.gap, keepWithNext: b.keepWithNext })),
    pageHeight
  )
  pages.forEach((indexes) => {
    startBureauPage(doc)
    // Blocks are positioned absolutely, so suspend PDFKit's own page flow.
    const savedBottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    try {
      drawBlockPage(
        doc,
        indexes.map((index) => blocks[index]),
        PAGE_MARGINS.top,
        pageHeight
      )
    } finally {
      doc.page.margins.bottom = savedBottom
    }
  })
}

/* ------------------------------------------------------------------ *
 * Block builders
 * ------------------------------------------------------------------ */

function textBlock(
  doc: Doc,
  text: string,
  opts: {
    font?: string
    size?: number
    color?: string
    gap?: number
    gapGrow?: number
    gapGrowMax?: number
    keepWithNext?: boolean
  } = {}
): SectionBlock {
  const font = opts.font || 'Helvetica'
  const size = opts.size ?? 9
  const color = opts.color || COLORS.text
  const height = lineHeightOf(doc, font, size)
  const value = safe(text)
  return block({
    height,
    gap: opts.gap ?? 0,
    gapGrow: opts.gapGrow ?? 0,
    gapGrowMax: opts.gapGrowMax ?? 0,
    keepWithNext: opts.keepWithNext,
    draw: (y) => {
      doc.font(font).fontSize(size).fillColor(color)
      doc.text(value, doc.page.margins.left, y, { width: contentWidth(doc), lineBreak: false })
    },
  })
}

function paragraphBlock(
  doc: Doc,
  text: string,
  opts: { size?: number; color?: string; lineGap?: number; gap?: number } = {}
): SectionBlock {
  const size = opts.size ?? 9
  const lineGap = opts.lineGap ?? 4
  const color = opts.color || COLORS.dim
  const value = safe(text)
  doc.font('Helvetica').fontSize(size)
  const height = doc.heightOfString(value, { width: contentWidth(doc), lineGap })
  return block({
    height,
    gap: opts.gap ?? 0,
    draw: (y) => {
      doc.font('Helvetica').fontSize(size).fillColor(color)
      doc.text(value, doc.page.margins.left, y, { width: contentWidth(doc), lineGap })
    },
  })
}

function reportRangeBlock(
  doc: Doc,
  fromSnap: CreditProgressReport['baseline'],
  toSnap: CreditProgressReport['current']
): SectionBlock {
  const fromLabel = safe(formatProgressDate(fromSnap?.reportDate || fromSnap?.createdAt))
  const toLabel = safe(formatProgressDate(toSnap?.reportDate || toSnap?.createdAt))
  const files = [fromSnap?.fileName, toSnap?.fileName]
    .filter(Boolean)
    .map((n) => truncateFilename(n!))
    .filter((n, i, all) => all.indexOf(n) === i)

  const lines: { text: string; size: number }[] = [
    { text: `Before: ${fromLabel}`, size: 9 },
    { text: `After: ${toLabel}`, size: 9 },
  ]
  if (files.length) lines.push({ text: files.join('   /   '), size: 8 })

  const rowGap = 3.5
  const heights = lines.map((line) => lineHeightOf(doc, 'Helvetica', line.size))
  const height = heights.reduce((sum, h) => sum + h, 0) + rowGap * (lines.length - 1)

  return block({
    height,
    gap: 10,
    gapGrow: 0.7,
    gapGrowMax: 16,
    draw: (y) => {
      let cursor = y
      lines.forEach((line, index) => {
        doc.font('Helvetica').fontSize(line.size).fillColor(COLORS.dim)
        doc.text(safe(line.text), doc.page.margins.left, cursor, {
          width: contentWidth(doc),
          lineBreak: false,
        })
        cursor += heights[index] + rowGap
      })
    },
  })
}

function scoreHeroBlock(
  doc: Doc,
  fromScore: number | null,
  toScore: number | null,
  scoreDelta: number | null,
  scoreColor: string
): SectionBlock {
  return block({
    height: HERO_H,
    grow: 1,
    growMax: 34,
    gap: 14,
    gapGrow: 1.4,
    gapGrowMax: 30,
    draw: (y, height) => {
      const boxW = contentWidth(doc)
      const left = doc.page.margins.left
      doc.roundedRect(left, y, boxW, height, CARD_RADIUS).fill(COLORS.softBg)

      const col1 = left + 18
      const col2 = left + boxW * 0.38
      const col3 = left + boxW * 0.72
      const labelY = y + Math.max(8, (height - 44) / 2)
      const scoreY = labelY + 18

      doc.fillColor(COLORS.dim).font('Helvetica').fontSize(8.5)
      doc.text('Before', col1, labelY, { lineBreak: false })
      doc.text('After', col2, labelY, { lineBreak: false })
      if (scoreDelta != null) doc.text('Change', col3, labelY, { lineBreak: false })

      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(26)
      doc.text(fromScore != null ? String(fromScore) : '-', col1, scoreY, { lineBreak: false })
      doc.text(toScore != null ? String(toScore) : '-', col2, scoreY, { lineBreak: false })

      drawArrow(doc, col1 + 48, scoreY + 9, col2 - 10, COLORS.accent)

      if (scoreDelta != null) {
        const label = scoreDelta > 0 ? `+${scoreDelta}` : String(scoreDelta)
        doc.fillColor(scoreColor).font('Helvetica-Bold').fontSize(20)
        doc.text(safe(`${label} pts`), col3, scoreY + 1, { lineBreak: false })
      }
    },
  })
}

function metricPillsBlock(doc: Doc, deltas: CreditProgressDelta[]): SectionBlock | null {
  const changed = deltas.filter((d) => d.from !== d.to)
  if (!changed.length) return null

  const cols = changed.length > 3 ? 2 : changed.length
  const rows = Math.ceil(changed.length / cols)
  const pillGap = 8
  const height = rows * PILL_H + (rows - 1) * PILL_ROW_GAP

  return block({
    height,
    grow: 0.7,
    growMax: rows * 10,
    gap: 14,
    gapGrow: 1.4,
    gapGrowMax: 30,
    draw: (y, totalHeight) => {
      const pillW = (contentWidth(doc) - pillGap * (cols - 1)) / cols
      const pillH = (totalHeight - (rows - 1) * PILL_ROW_GAP) / rows
      changed.forEach((d, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = doc.page.margins.left + col * (pillW + pillGap)
        const pillY = y + row * (pillH + PILL_ROW_GAP)
        doc.roundedRect(x, pillY, pillW, pillH, 6).fill(COLORS.cardBg)
        const labelY = pillY + Math.max(4, (pillH - 22) / 2)
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.dim)
        doc.text(fitText(doc, d.label, pillW - 16), x + 8, labelY, {
          width: pillW - 16,
          lineBreak: false,
        })
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.text)
        const valueY = labelY + 12
        doc.text(formatDeltaValue(d.from), x + 8, valueY, {
          width: pillW * 0.38,
          lineBreak: false,
        })
        drawArrow(doc, x + pillW * 0.42, valueY + 3.5, x + pillW * 0.56, COLORS.border)
        doc.fillColor(directionColor(d.direction))
        doc.text(formatDeltaValue(d.to), x + pillW * 0.58, valueY, {
          width: pillW * 0.34,
          lineBreak: false,
        })
      })
    },
  })
}

export function accountCardHeight(fieldCount: number): number {
  const rows = fieldCount * FIELD_TEXT_H + Math.max(fieldCount - 1, 0) * FIELD_ROW_GAP
  return CARD_PAD * 2 + TITLE_ROW_H + rows
}

/**
 * Group cards into rows of `columns`. Cards of equal height are paired so a
 * multi-column grid wastes almost no vertical space, and the tallest rows
 * lead so the grid reads top-heavy instead of ragged.
 */
export function planAccountCardRows(heights: number[], columns: number): number[][] {
  if (columns <= 1) return heights.map((_, index) => [index])
  const ordered = heights
    .map((height, index) => ({ height, index }))
    .sort((a, b) => b.height - a.height || a.index - b.index)
  const rows: number[][] = []
  for (let i = 0; i < ordered.length; i += columns) {
    rows.push(
      ordered
        .slice(i, i + columns)
        .map((entry) => entry.index)
        .sort((a, b) => a - b)
    )
  }
  return rows
}

/**
 * One label column for the whole grid: wide enough for the longest label in
 * play, so narrow cards spend their width on values instead of blank gutter.
 */
function fieldLabelWidth(doc: Doc, cards: TradelineFieldChange[], innerWidth: number): number {
  doc.font('Helvetica').fontSize(7.5)
  let widest = 0
  for (const card of cards) {
    for (const field of card.fields) {
      widest = Math.max(widest, doc.widthOfString(safe(field.label)))
    }
  }
  const cap = Math.min(FIELD_LABEL_W, Math.max(30, innerWidth * 0.3))
  return Math.min(cap, widest + 6)
}

function drawFieldRow(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  labelW: number,
  field: TradelineFieldChange['fields'][number]
) {
  const narrow = width < NARROW_CARD_W
  const arrowW = narrow ? 12 : 16
  const gap = 5
  const valueW = (width - labelW - arrowW - gap * 2) / 2
  const valueSize = narrow ? 8 : 8.5

  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.dim)
  doc.text(fitText(doc, field.label, labelW), x, y, { width: labelW, lineBreak: false })

  const fromX = x + labelW
  doc.font('Helvetica').fontSize(valueSize).fillColor(COLORS.muted)
  doc.text(fitText(doc, field.from, valueW), fromX, y, { width: valueW, lineBreak: false })

  const arrowX = fromX + valueW + gap
  drawArrow(doc, arrowX, y + 3.5, arrowX + arrowW, COLORS.border)

  const toX = arrowX + arrowW + gap
  doc.font('Helvetica').fontSize(valueSize).fillColor(directionColor(field.direction))
  doc.text(fitText(doc, field.to, valueW), toX, y, { width: valueW, lineBreak: false })
}

function drawAccountCard(
  doc: Doc,
  x: number,
  y: number,
  width: number,
  height: number,
  card: TradelineFieldChange,
  labelW: number
) {
  doc.roundedRect(x, y, width, height, CARD_RADIUS).fillAndStroke(COLORS.white, COLORS.border)

  const innerW = width - CARD_PAD * 2
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.text)
  const maskLabel = formatAccountMaskForPdf(card.accountMask)
  const maskW = maskLabel ? doc.widthOfString(`  ${maskLabel}`) : 0
  const creditor = fitText(doc, card.creditor, innerW - maskW)
  const title = maskLabel ? `${creditor}  ${maskLabel}` : creditor
  doc.text(title, x + CARD_PAD, y + CARD_PAD, { width: innerW, lineBreak: false })

  let rowY = y + CARD_PAD + TITLE_ROW_H
  for (const field of card.fields) {
    drawFieldRow(doc, x + CARD_PAD, rowY, innerW, labelW, field)
    rowY += FIELD_ROW_H
  }
}

function accountCardBlocks(
  doc: Doc,
  cards: TradelineFieldChange[],
  columns: number
): SectionBlock[] {
  const heights = cards.map((card) => accountCardHeight(card.fields.length))
  const rows = planAccountCardRows(heights, columns)
  const cardW = (contentWidth(doc) - CARD_COLUMN_GAP * (columns - 1)) / columns
  const labelW = fieldLabelWidth(doc, cards, cardW - CARD_PAD * 2)

  return rows.map((row) =>
    block({
      height: Math.max(...row.map((index) => heights[index])),
      gap: ACCOUNT_CARD_GAP,
      gapGrow: 0.55,
      gapGrowMax: 14,
      draw: (y, height) => {
        row.forEach((cardIndex, col) => {
          const x = doc.page.margins.left + col * (cardW + CARD_COLUMN_GAP)
          drawAccountCard(doc, x, y, cardW, height, cards[cardIndex], labelW)
        })
      },
    })
  )
}

function simpleListBlocks(
  doc: Doc,
  items: { creditor: string; accountMask: string; category?: string }[],
  title: string,
  itemColor: string
): SectionBlock[] {
  if (!items.length) return []
  const blocks: SectionBlock[] = [
    textBlock(doc, title, {
      font: 'Helvetica-Bold',
      size: 11,
      color: COLORS.text,
      gap: 5,
      gapGrow: 0.2,
      gapGrowMax: 6,
      keepWithNext: true,
    }),
  ]
  items.forEach((item) => {
    const mask = formatAccountMaskForPdf(item.accountMask)
    const inquiryTag =
      item.category === 'inquiry' || /inquir/i.test(item.category || '') ? ' (Inquiry)' : ''
    const line = mask
      ? `${safe(item.creditor)}  ${mask}${inquiryTag}`
      : `${safe(item.creditor)}${inquiryTag}`
    blocks.push(
      textBlock(doc, line, {
        size: 9,
        color: itemColor,
        gap: 4,
        gapGrow: 0.35,
        gapGrowMax: 8,
      })
    )
  })
  return blocks
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

type BureauSectionData = {
  label: string
  fromSnap: CreditProgressReport['baseline']
  toSnap: CreditProgressReport['current']
  fromScore: number | null
  toScore: number | null
  metricDeltas: CreditProgressDelta[]
  diff: TradelineProgressDiff | null | undefined
  hasAccounts: boolean
  includeDisclaimer: boolean
}

function buildBureauBlocks(doc: Doc, data: BureauSectionData, columns: number): SectionBlock[] {
  const blocks: SectionBlock[] = []

  blocks.push(
    textBlock(doc, data.label, {
      font: 'Helvetica-Bold',
      size: 18,
      color: COLORS.text,
      gap: 7,
      gapGrow: 0.35,
      gapGrowMax: 10,
    })
  )
  blocks.push(reportRangeBlock(doc, data.fromSnap, data.toSnap))

  const scoreDelta =
    data.fromScore != null && data.toScore != null ? data.toScore - data.fromScore : null
  const scoreColor =
    scoreDelta == null
      ? COLORS.text
      : scoreDelta > 0
        ? COLORS.emerald
        : scoreDelta < 0
          ? COLORS.red
          : COLORS.text
  blocks.push(scoreHeroBlock(doc, data.fromScore, data.toScore, scoreDelta, scoreColor))

  if (data.toScore == null && data.hasAccounts) {
    blocks.push(
      paragraphBlock(
        doc,
        'Score was not extracted from the newer report file. Account changes below still apply.',
        { color: COLORS.amber, gap: 12 }
      )
    )
    openSectionGap(blocks, 12, 0.8, 18)
  }

  const pills = metricPillsBlock(doc, data.metricDeltas)
  if (pills) {
    blocks.push(
      textBlock(doc, 'Profile summary', {
        font: 'Helvetica-Bold',
        size: 11,
        gap: 6,
        gapGrow: 0.2,
        gapGrowMax: 6,
        keepWithNext: true,
      })
    )
    blocks.push(pills)
  }

  blocks.push(
    textBlock(doc, 'Account changes', {
      font: 'Helvetica-Bold',
      size: 11,
      gap: 6,
      gapGrow: 0.2,
      gapGrowMax: 6,
      keepWithNext: true,
    })
  )

  if (!data.hasAccounts) {
    blocks.push(
      paragraphBlock(
        doc,
        data.diff?.matchConfidence === 'low'
          ? 'Could not match accounts between these two reports.'
          : 'No account-level changes for this bureau.',
        { gap: 14 }
      )
    )
  } else {
    const diff = data.diff!
    if (diff.changed.length > 0) {
      blocks.push(
        textBlock(doc, 'Updated', {
          font: 'Helvetica-Bold',
          size: 10,
          color: COLORS.muted,
          gap: 5,
          keepWithNext: true,
        })
      )
      blocks.push(...accountCardBlocks(doc, diff.changed, columns))
    }

    const removed = simpleListBlocks(doc, diff.removed, 'Removed from report', COLORS.emerald)
    if (removed.length) {
      openSectionGap(blocks, 14, 1.1, 26)
      blocks.push(...removed)
    }
    const added = simpleListBlocks(doc, diff.added, 'New on report', COLORS.amber)
    if (added.length) {
      openSectionGap(blocks, 14, 1.1, 26)
      blocks.push(...added)
    }
  }

  if (data.includeDisclaimer) {
    openSectionGap(blocks, 16, 1, 24)
    const last = blocks[blocks.length - 1]
    if (last) last.keepWithNext = true
    blocks.push(
      paragraphBlock(
        doc,
        'Educational progress tracking only. Not a credit score, funding decision, or legal advice.'
      )
    )
  }

  const tail = blocks[blocks.length - 1]
  if (tail) {
    tail.gap = 0
    tail.gapGrow = 0
    tail.gapGrowMax = 0
    tail.keepWithNext = false
  }

  return blocks
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

    const pageHeight = sectionHeight(doc)

    for (let bureauIndex = 0; bureauIndex < bureaus.length; bureauIndex += 1) {
      const bureau = bureaus[bureauIndex]
      const report = input.progressByBureau[bureau]!
      const accounts = activeAccountDiff(report, input.compareMode)
      const deltas = activeDeltas(report, input.compareMode)
      const data: BureauSectionData = {
        label: BUREAU_LABELS[bureau],
        fromSnap:
          input.compareMode === 'previous' && report.previous ? report.previous : report.baseline,
        toSnap: report.current,
        fromScore: scoreForBureau(report, 'from', input.compareMode),
        toScore: scoreForBureau(report, 'to', input.compareMode),
        metricDeltas: deltas.filter((d) => d.field !== 'bureau_score'),
        diff: accounts,
        hasAccounts:
          !!accounts &&
          (accounts.removed.length > 0 ||
            accounts.added.length > 0 ||
            accounts.changed.length > 0),
        includeDisclaimer: bureauIndex === bureaus.length - 1,
      }

      const toPackItems = (blocks: SectionBlock[]): PackItem[] =>
        blocks.map((b) => ({ height: b.height, gapAfter: b.gap, keepWithNext: b.keepWithNext }))

      let blocks = buildBureauBlocks(doc, data, 1)
      let pages = packSectionPages(toPackItems(blocks), pageHeight).length
      if (pages > 1 && (accounts?.changed.length || 0) > 1) {
        const wide = buildBureauBlocks(doc, data, 2)
        const widePages = packSectionPages(toPackItems(wide), pageHeight).length
        if (widePages < pages) {
          blocks = wide
          pages = widePages
        }
      }

      renderSection(doc, blocks)
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
