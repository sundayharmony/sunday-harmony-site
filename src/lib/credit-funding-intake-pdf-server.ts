import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import type { IntakePdfFile, IntakePdfModel, IntakePdfSection } from '@/lib/credit-funding-intake-pdf'

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 54
const MARGIN_TOP = 54
const MARGIN_BOTTOM = 52
export const INTAKE_PDF_MAX_PAGES_PER_FILE = 40
export const INTAKE_PDF_MAX_ATTACHMENT_PAGES = 120

const ink = rgb(0.039, 0.039, 0.039)
const muted = rgb(0.36, 0.36, 0.36)
const accent = rgb(0.722, 0.58, 0.247)

type DrawContext = {
  doc: PDFDocument
  font: PDFFont
  bold: PDFFont
  numbered: PDFPage[]
  page: PDFPage
  y: number
}

function pdfSafe(value: string): string {
  return value
    .replace(/\u2014|\u2013/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7E\n]/g, '')
}

function contentWidth() {
  return PAGE_WIDTH - MARGIN_X * 2
}

function wrapLine(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  if (!words[0]) return []
  const lines: string[] = []
  let line = ''
  const pushWord = (word: string) => {
    if (font.widthOfTextAtSize(word, size) <= width) {
      line = word
      return
    }
    let chunk = ''
    for (const char of word) {
      const next = chunk + char
      if (font.widthOfTextAtSize(next, size) > width && chunk) {
        lines.push(chunk)
        chunk = char
      } else {
        chunk = next
      }
    }
    line = chunk
  }
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width) {
      line = next
    } else {
      if (line) lines.push(line)
      pushWord(word)
    }
  }
  if (line) lines.push(line)
  return lines
}

function addPage(ctx: DrawContext) {
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  ctx.numbered.push(ctx.page)
  ctx.y = PAGE_HEIGHT - MARGIN_TOP
}

function ensure(ctx: DrawContext, needed: number) {
  if (ctx.y - needed < MARGIN_BOTTOM) addPage(ctx)
}

function drawLines(ctx: DrawContext, lines: string[], font: PDFFont, size: number, color: ReturnType<typeof rgb>, gap = 3) {
  const lineHeight = size + gap
  for (const line of lines) {
    ensure(ctx, lineHeight)
    ctx.page.drawText(line, { x: MARGIN_X, y: ctx.y - size, size, font, color })
    ctx.y -= lineHeight
  }
}

function drawParagraph(ctx: DrawContext, text: string, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  const blocks = pdfSafe(text).split('\n')
  for (const block of blocks) {
    const lines = wrapLine(block, font, size, contentWidth())
    if (lines.length === 0) {
      ctx.y -= size
      continue
    }
    drawLines(ctx, lines, font, size, color)
  }
}

function drawSection(ctx: DrawContext, section: IntakePdfSection) {
  ensure(ctx, 36)
  ctx.y -= 8
  ctx.page.drawText(pdfSafe(section.title), {
    x: MARGIN_X,
    y: ctx.y - 13,
    size: 13,
    font: ctx.bold,
    color: ink,
  })
  ctx.y -= 18
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: MARGIN_X + 72, y: ctx.y },
    thickness: 1.5,
    color: accent,
  })
  ctx.y -= 12
  if (section.note) {
    drawParagraph(ctx, section.note, ctx.font, 9, muted)
    ctx.y -= 6
  }
  for (const item of section.fields) {
    ensure(ctx, 28)
    drawLines(ctx, wrapLine(pdfSafe(item.label).toUpperCase(), ctx.bold, 8, contentWidth()), ctx.bold, 8, muted, 2)
    ctx.y -= 2
    drawParagraph(ctx, item.value, ctx.font, 11, ink)
    ctx.y -= 8
  }
}

function paintFooters(ctx: DrawContext) {
  const total = ctx.doc.getPageCount()
  for (const page of ctx.numbered) {
    const index = ctx.doc.getPages().indexOf(page) + 1
    page.drawText('Sunday Harmony · Client intake', {
      x: MARGIN_X,
      y: 28,
      size: 8,
      font: ctx.font,
      color: muted,
    })
    const label = `${index} / ${total}`
    const width = ctx.font.widthOfTextAtSize(label, 8)
    page.drawText(label, {
      x: page.getWidth() - MARGIN_X - width,
      y: 28,
      size: 8,
      font: ctx.font,
      color: muted,
    })
  }
}

function sniffKind(bytes: Uint8Array, declared: IntakePdfFile['kind']): IntakePdfFile['kind'] | 'unknown' {
  if (bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString() === '%PDF-') return 'pdf'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png'
  }
  if (declared === 'text') return 'text'
  return 'unknown'
}

function drawFileNote(ctx: DrawContext, label: string, fileName: string, message: string) {
  addPage(ctx)
  drawParagraph(ctx, label, ctx.bold, 14, ink)
  ctx.y -= 6
  drawParagraph(ctx, fileName, ctx.font, 10, muted)
  ctx.y -= 10
  drawParagraph(ctx, message, ctx.font, 11, ink)
}

async function appendImage(ctx: DrawContext, file: IntakePdfFile, image: PDFImage) {
  addPage(ctx)
  drawParagraph(ctx, file.label, ctx.bold, 13, ink)
  ctx.y -= 4
  drawParagraph(ctx, file.fileName, ctx.font, 9, muted)
  ctx.y -= 12
  const maxWidth = contentWidth()
  const maxHeight = ctx.y - MARGIN_BOTTOM
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height)
  const width = image.width * scale
  const height = image.height * scale
  const x = MARGIN_X + (maxWidth - width) / 2
  ctx.page.drawImage(image, { x, y: ctx.y - height, width, height })
  ctx.y -= height
}

async function appendPdf(ctx: DrawContext, file: IntakePdfFile, bytes: Uint8Array, remainingPages: { count: number }) {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const indices = source.getPageIndices()
  const allowed = Math.min(indices.length, INTAKE_PDF_MAX_PAGES_PER_FILE, remainingPages.count)
  if (allowed <= 0) {
    drawFileNote(
      ctx,
      file.label,
      file.fileName,
      'This file stays in the application documents so the PDF can be downloaded.'
    )
    return
  }
  addPage(ctx)
  drawParagraph(ctx, file.label, ctx.bold, 14, ink)
  ctx.y -= 6
  drawParagraph(ctx, file.fileName, ctx.font, 10, muted)
  ctx.y -= 12
  const follow =
    allowed === indices.length
      ? `${allowed} ${allowed === 1 ? 'page follows' : 'pages follow'}.`
      : `The first ${allowed} pages follow. The rest of this file stays in the application documents.`
  drawParagraph(ctx, follow, ctx.font, 11, ink)
  const copied = await ctx.doc.copyPages(source, indices.slice(0, allowed))
  for (const page of copied) ctx.doc.addPage(page)
  remainingPages.count -= allowed
}

export async function renderIntakePdf(model: IntakePdfModel, files: IntakePdfFile[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ctx: DrawContext = {
    doc,
    font,
    bold,
    numbered: [],
    page: null as unknown as PDFPage,
    y: 0,
  }
  addPage(ctx)
  drawParagraph(ctx, 'Sunday Harmony', ctx.bold, 11, accent)
  ctx.y -= 4
  drawParagraph(ctx, model.heading, ctx.bold, 22, ink)
  ctx.y -= 4
  drawParagraph(ctx, model.clientName, ctx.font, 14, ink)
  if (model.meta) {
    ctx.y -= 2
    drawParagraph(ctx, model.meta, ctx.font, 10, muted)
  }
  ctx.y -= 2
  drawParagraph(ctx, `Prepared ${model.preparedAt}`, ctx.font, 9, muted)
  ctx.y -= 8

  for (const section of model.sections) drawSection(ctx, section)

  const remainingPages = { count: INTAKE_PDF_MAX_ATTACHMENT_PAGES }
  for (const file of files) {
    const kind = sniffKind(file.bytes, file.kind)
    try {
      if (kind === 'pdf') {
        await appendPdf(ctx, file, file.bytes, remainingPages)
      } else if (kind === 'jpeg') {
        await appendImage(ctx, file, await doc.embedJpg(file.bytes))
      } else if (kind === 'png') {
        await appendImage(ctx, file, await doc.embedPng(file.bytes))
      } else if (kind === 'text') {
        const text = Buffer.from(file.bytes).toString('utf8').replace(/\u0000/g, '').slice(0, 80_000)
        addPage(ctx)
        drawParagraph(ctx, file.label, ctx.bold, 14, ink)
        ctx.y -= 4
        drawParagraph(ctx, file.fileName, ctx.font, 9, muted)
        ctx.y -= 12
        drawParagraph(ctx, text || 'This file is empty.', ctx.font, 10, ink)
      } else {
        drawFileNote(
          ctx,
          file.label,
          file.fileName,
          'This file stays in the application documents. It could not be placed in the PDF.'
        )
      }
    } catch {
      drawFileNote(
        ctx,
        file.label,
        file.fileName,
        'This file stays in the application documents. It could not be placed in the PDF.'
      )
    }
  }

  paintFooters(ctx)
  return doc.save()
}
