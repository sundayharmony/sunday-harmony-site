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
      margins: { top: 120, bottom: 72, left: 72, right: 72 },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
    doc.on('error', reject)

    for (const block of layout.blocks) drawBlock(doc, block)
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
    if (labelDate && 72 + dateWidth + 12 < width - 72 - labelWidth) {
      page.drawText(labelDate, { x: 72, y: baseline, size, font, color: ink })
    }
    page.drawText(label, {
      x: Math.max(36, width - 72 - labelWidth),
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

function drawBlock(doc: PDFKit.PDFDocument, block: LetterPreviewBlock) {
  if (block.kind === 'spacer') {
    doc.moveDown(0.55)
    return
  }
  if (block.kind === 'bullet') {
    drawInline(doc, block.text, { indent: 16, prefix: '- ' })
    return
  }
  const indent = (block.indent || 0) * 18
  if (block.variant === 'heading' || block.variant === 'name') {
    if (block.variant === 'heading') doc.moveDown(0.45)
    drawInline(doc, block.text || '', { indent, boldAll: true })
    return
  }
  if (block.variant === 'closing') {
    doc.moveDown(0.6)
    drawInline(doc, block.text || '', { indent })
    return
  }
  if (block.variant === 'signature') {
    drawSignature(doc, block.text || '')
    return
  }
  const tight = block.variant === 'tight' || block.variant === 'field'
  drawInline(doc, block.text || '', { indent, lineGap: tight ? 1 : 3 })
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
