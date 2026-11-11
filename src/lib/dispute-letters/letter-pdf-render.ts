import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pdfSafeText } from '@/lib/credit-intelligence-pdf'
import { letterLayout } from '@/lib/dispute-letters/letter-layout'
import type { LetterPacketAttachment } from '@/lib/dispute-letters/letter-identity-attachments'
import { isPdfBytes } from '@/lib/dispute-letters/letter-zip'
import type { GeneratedLetter, LetterPreviewBlock, LetterPreviewLayout } from '@/lib/dispute-letters/types'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import PDFDocumentKit from 'pdfkit'

/** Same cursive face the on-screen preview and the Python letter use. */
const SIGNATURE_FONT = join(
  process.cwd(),
  'services/dispute-letters-api/assets/fonts/GreatVibes-Regular.ttf'
)

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792

/** Narrower than a 1in inset so the letter uses more of the page. The top stays clear of the date. */
export const LETTER_MARGIN_SIDE = 36
export const LETTER_MARGIN_BOTTOM = 32
export const LETTER_MARGIN_TOP = 120
const SECTION_GAP = 16
const CLOSING_GAP = 10
const PARAGRAPH_GAP = 6
const HEADING_AFTER = 6
const SPACER_GAP = 10

export function groupLetterBlocks(blocks: LetterPreviewBlock[]): LetterPreviewBlock[][] {
  const groups: LetterPreviewBlock[][] = []
  let index = 0
  while (index < blocks.length) {
    const block = blocks[index]
    if (block.kind === 'line' && block.variant === 'heading') {
      const group = [block]
      index += 1
      const follow = blocks[index]
      if (
        follow &&
        follow.kind !== 'spacer' &&
        !(follow.kind === 'line' && follow.variant === 'heading')
      ) {
        group.push(follow)
        index += 1
      }
      groups.push(group)
      continue
    }
    if (block.kind === 'line' && block.variant === 'closing') {
      const group = [block]
      index += 1
      while (blocks[index]?.kind === 'spacer') {
        group.push(blocks[index])
        index += 1
      }
      if (blocks[index]?.kind === 'line' && blocks[index].variant === 'signature') {
        group.push(blocks[index])
        index += 1
      }
      groups.push(group)
      continue
    }
    if (isRunOnBlock(block)) {
      const group = [block]
      index += 1
      while (isRunOnBlock(blocks[index])) {
        group.push(blocks[index])
        index += 1
      }
      groups.push(group)
      continue
    }
    groups.push([block])
    index += 1
  }
  return groups
}

function isRunOnBlock(block: LetterPreviewBlock | undefined): boolean {
  return Boolean(
    block && block.kind === 'line' && (block.variant === 'name' || block.variant === 'field' || block.variant === 'tight')
  )
}

/** Start a new page when the whole group fits on a blank page and not in the space left. */
export function shouldKeepGroupTogether(groupHeight: number, remaining: number, pageContentHeight: number): boolean {
  if (groupHeight <= 1) return false
  if (groupHeight > pageContentHeight + 1) return false
  return groupHeight > remaining + 0.5
}

type LetterPdfSource = {
  title?: string
  preview?: GeneratedLetter['preview']
  markdown?: string
  plain_text?: string
}

export function layoutForLetter(letter: LetterPdfSource): LetterPreviewLayout {
  if (letter.preview?.blocks?.length) return letter.preview
  return letterLayout(letter.markdown || letter.plain_text || '')
}

/** One sentence for staff. Never return an HTML or Cloudflare body. */
export function publicLetterFailure(error: unknown, fallback = 'Letter PDF could not be saved.'): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (!raw || /<!doctype|<html|just a moment|cloudflare/i.test(raw) || raw.includes('<')) {
    return fallback
  }
  const line = raw.replace(/\s+/g, ' ').trim()
  if (!line || line.length > 180) return fallback
  return line
}

function renderLetterBody(layout: LetterPreviewLayout): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocumentKit({
      size: 'LETTER',
      margins: {
        top: LETTER_MARGIN_TOP,
        bottom: LETTER_MARGIN_BOTTOM,
        left: LETTER_MARGIN_SIDE,
        right: LETTER_MARGIN_SIDE,
      },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
    doc.on('error', reject)

    const blocks = layout.blocks
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index]
      const pageContent = doc.page.height - doc.page.margins.top - doc.page.margins.bottom
      const remaining = doc.page.height - doc.page.margins.bottom - doc.y
      const height = measureBlock(doc, block)
      let needed = height
      const next = blocks[index + 1]
      if (block.kind === 'line' && block.variant === 'heading' && next) {
        const follow = measureBlock(doc, next)
        if (follow <= pageContent + 1 && height + follow > remaining) needed = height + follow
        else if (remaining < height + 36) needed = height + 36
      } else if (block.kind === 'line' && block.variant === 'closing') {
        for (let look = index + 1; look < blocks.length && look <= index + 2; look += 1) {
          const ahead = blocks[look]
          if (ahead.kind === 'line' && ahead.variant === 'signature') needed += measureBlock(doc, ahead)
        }
      }
      if (shouldKeepGroupTogether(needed, remaining, pageContent)) doc.addPage()
      else if (height > pageContent + 1 && remaining < 64) doc.addPage()
      drawBlock(doc, block)
    }
    if (layout.blocks.length === 0) {
      doc.font('Times-Roman').fontSize(12).text(' ')
    }
    doc.end()
  })
}

/** Date on the left and "Page n of m" on the right, on every page of the file. */
export async function stampLetterPageNumbers(bytes: Uint8Array, date: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes)
  const font = await doc.embedFont(StandardFonts.TimesRoman)
  const pages = doc.getPages()
  const total = pages.length
  const labelDate = pdfSafeText(date).slice(0, 80)
  const size = 10
  const ink = rgb(0.07, 0.07, 0.07)
  pages.forEach((page, index) => {
    const { width, height } = page.getSize()
    const label = `Page ${index + 1} of ${total}`
    const labelWidth = font.widthOfTextAtSize(label, size)
    // Baseline sits 1in below the top edge so the date and page number are not cramped.
    const baseline = height - 72
    page.drawRectangle({
      x: 0,
      y: height - 96,
      width,
      height: 96,
      color: rgb(1, 1, 1),
    })
    const dateWidth = labelDate ? font.widthOfTextAtSize(labelDate, size) : 0
    if (labelDate && LETTER_MARGIN_SIDE + dateWidth + 12 < width - LETTER_MARGIN_SIDE - labelWidth) {
      page.drawText(labelDate, { x: LETTER_MARGIN_SIDE, y: baseline, size, font, color: ink })
    }
    page.drawText(label, {
      x: Math.max(36, width - LETTER_MARGIN_SIDE - labelWidth),
      y: baseline,
      size,
      font,
      color: ink,
    })
  })
  return new Uint8Array(await doc.save())
}

export async function renderLetterPreviewPdf(layout: LetterPreviewLayout): Promise<Uint8Array> {
  const body = await renderLetterBody(layout)
  return stampLetterPageNumbers(body, layout.date || '')
}

type InlinePart = { bold: boolean; text: string }

/** Turn **account titles** into bold spans so the PDF never prints the asterisks. */
export function letterInlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  for (const part of (text || '').split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = pdfSafeText(part.slice(2, -2))
      if (inner) parts.push({ bold: true, text: inner })
      continue
    }
    const plain = pdfSafeText(part)
    if (plain) parts.push({ bold: false, text: plain })
  }
  return parts
}

function drawInline(
  doc: PDFKit.PDFDocument,
  text: string,
  options: { indent?: number; lineGap?: number; boldAll?: boolean; prefix?: string }
) {
  const parts = letterInlineParts(options.prefix ? `${options.prefix}${text}` : text)
  if (!parts.length) {
    doc.font('Times-Roman').fontSize(12).text(' ')
    return
  }
  parts.forEach((part, index) => {
    doc
      .font(options.boldAll || part.bold ? 'Times-Bold' : 'Times-Roman')
      .fontSize(12)
      .fillColor('#111111')
      .text(part.text, {
        indent: index === 0 ? options.indent || 0 : 0,
        lineGap: options.lineGap,
        continued: index < parts.length - 1,
      })
  })
}

function drawSignature(doc: PDFKit.PDFDocument, name: string) {
  const clean = letterInlineParts(name)
    .map((part) => part.text)
    .join('')
    .trim()
  doc.moveDown(1.1)
  const left = doc.page.margins.left
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const y = doc.y
  doc.font('Times-Bold').fontSize(12).fillColor('#111111').text(clean || ' ', left, y, {
    width: width * 0.48,
    align: 'left',
  })
  const afterName = doc.y
  const script = existsSync(SIGNATURE_FONT) && clean && !clean.startsWith('[')
  if (script) {
    doc.font(SIGNATURE_FONT).fontSize(22).fillColor('#141414').text(clean, left + width * 0.4, Math.max(y - 10, doc.page.margins.top), {
      width: width * 0.6,
      align: 'right',
      lineBreak: false,
    })
  } else if (clean) {
    doc.font('Times-Italic').fontSize(16).fillColor('#141414').text(clean, left + width * 0.4, y, {
      width: width * 0.6,
      align: 'right',
    })
  }
  doc.x = left
  doc.y = Math.max(doc.y, afterName) + 6
}

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function atPageTop(doc: PDFKit.PDFDocument): boolean {
  return doc.y <= doc.page.margins.top + 1
}

function blockPlainText(block: LetterPreviewBlock): string {
  if (block.kind === 'spacer') return ''
  if (block.kind === 'bullet') return `- ${block.text || ''}`
  return letterInlineParts(block.text || '')
    .map((part) => part.text)
    .join('')
}

function measureBlock(doc: PDFKit.PDFDocument, block: LetterPreviewBlock): number {
  if (block.kind === 'spacer') return SPACER_GAP
  if (block.kind === 'line' && block.variant === 'signature') return 12 * 1.1 + 32
  const indent = block.kind === 'line' ? (block.indent || 0) * 18 : 0
  const tight =
    block.kind === 'line' && (block.variant === 'tight' || block.variant === 'field' || block.variant === 'name')
  doc.font('Times-Bold').fontSize(12)
  const textHeight = doc.heightOfString(blockPlainText(block) || ' ', {
    width: Math.max(72, contentWidth(doc) - (block.kind === 'bullet' ? 16 : indent)),
    lineGap: tight ? 1 : 3,
  })
  if (block.kind === 'bullet') return textHeight + 2
  let extra = 0
  if (block.kind === 'line' && block.variant === 'heading') {
    extra += (atPageTop(doc) ? 0 : SECTION_GAP) + HEADING_AFTER
  } else if (block.kind === 'line' && block.variant === 'closing') {
    extra += atPageTop(doc) ? 0 : CLOSING_GAP
  } else if (!tight) {
    extra += PARAGRAPH_GAP
  }
  return textHeight + extra
}

function drawBlock(doc: PDFKit.PDFDocument, block: LetterPreviewBlock) {
  if (block.kind === 'spacer') {
    doc.y += SPACER_GAP
    return
  }
  if (block.kind === 'bullet') {
    drawInline(doc, block.text, { indent: 16, prefix: '- ', lineGap: 3 })
    doc.y += 2
    return
  }
  const indent = (block.indent || 0) * 18
  if (block.variant === 'heading' || block.variant === 'name') {
    if (block.variant === 'heading' && !atPageTop(doc)) doc.y += SECTION_GAP
    drawInline(doc, block.text || '', { indent, boldAll: true, lineGap: 2 })
    if (block.variant === 'heading') doc.y += HEADING_AFTER
    return
  }
  if (block.variant === 'closing') {
    if (!atPageTop(doc)) doc.y += CLOSING_GAP
    drawInline(doc, block.text || '', { indent, lineGap: 2 })
    return
  }
  if (block.variant === 'signature') {
    drawSignature(doc, block.text || '')
    return
  }
  const tight = block.variant === 'tight' || block.variant === 'field'
  drawInline(doc, block.text || '', { indent, lineGap: tight ? 1 : 3 })
  if (!tight) doc.y += PARAGRAPH_GAP
}

async function appendAttachment(doc: PDFDocument, file: LetterPacketAttachment) {
  if (isPdfBytes(file.data)) {
    const source = await PDFDocument.load(file.data, { ignoreEncryption: true })
    const pages = await doc.copyPages(source, source.getPageIndices())
    for (const page of pages) doc.addPage(page)
    return
  }
  const mime = (file.mimeType || '').toLowerCase()
  const isPng = mime.includes('png') || (file.data[0] === 0x89 && file.data[1] === 0x50)
  const isJpg = mime.includes('jpeg') || mime.includes('jpg') || (file.data[0] === 0xff && file.data[1] === 0xd8)
  if (!isPng && !isJpg) return
  const image = isPng ? await doc.embedPng(file.data) : await doc.embedJpg(file.data)
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const margin = 36
  const maxW = PAGE_WIDTH - margin * 2
  const maxH = PAGE_HEIGHT - margin * 2
  const scale = Math.min(maxW / image.width, maxH / image.height)
  const width = image.width * scale
  const height = image.height * scale
  page.drawImage(image, {
    x: (PAGE_WIDTH - width) / 2,
    y: (PAGE_HEIGHT - height) / 2,
    width,
    height,
  })
}

/** Letter text plus identity documents. Does not call the letter API download URL. */
export async function renderLetterPdfWithIdentity(
  letter: LetterPdfSource,
  attachments: LetterPacketAttachment[] = []
): Promise<Uint8Array> {
  const title = letter.title || 'letter'
  const layout = layoutForLetter(letter)
  const letterPdf = await renderLetterBody(layout)
  if (!isPdfBytes(letterPdf)) {
    throw new Error(`Letter "${title}" could not be saved as a PDF.`)
  }
  if (!attachments.length) return stampLetterPageNumbers(letterPdf, layout.date || '')
  const doc = await PDFDocument.load(letterPdf)
  for (const file of attachments) {
    try {
      await appendAttachment(doc, file)
    } catch (error) {
      console.warn(
        'identity enclosure skipped',
        file.zipName,
        error instanceof Error ? error.message : error
      )
    }
  }
  const saved = await stampLetterPageNumbers(new Uint8Array(await doc.save()), layout.date || '')
  if (!isPdfBytes(saved)) {
    throw new Error(`Letter "${title}" could not be saved as a PDF.`)
  }
  return saved
}
