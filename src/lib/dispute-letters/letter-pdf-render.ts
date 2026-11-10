import { pdfSafeText } from '@/lib/credit-intelligence-pdf'
import { letterLayout } from '@/lib/dispute-letters/letter-layout'
import type { LetterPacketAttachment } from '@/lib/dispute-letters/letter-identity-attachments'
import { isPdfBytes } from '@/lib/dispute-letters/letter-zip'
import type { GeneratedLetter, LetterPreviewBlock, LetterPreviewLayout } from '@/lib/dispute-letters/types'
import { PDFDocument } from 'pdf-lib'
import PDFDocumentKit from 'pdfkit'

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

export function renderLetterPreviewPdf(layout: LetterPreviewLayout): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocumentKit({
      size: 'LETTER',
      margins: { top: 64, bottom: 72, left: 72, right: 72 },
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
    doc.on('error', reject)

    const date = pdfSafeText(layout.date || '')
    if (date) {
      doc.font('Times-Roman').fontSize(11).fillColor('#111111').text(date)
      doc.moveDown(0.8)
    }
    for (const block of layout.blocks) drawBlock(doc, block)
    if (!date && layout.blocks.length === 0) {
      doc.font('Times-Roman').fontSize(12).text(' ')
    }
    doc.end()
  })
}

function drawBlock(doc: PDFKit.PDFDocument, block: LetterPreviewBlock) {
  if (block.kind === 'spacer') {
    doc.moveDown(0.55)
    return
  }
  if (block.kind === 'bullet') {
    doc.font('Times-Roman').fontSize(12).fillColor('#111111')
    doc.text(pdfSafeText(`- ${block.text}`), { indent: 16 })
    return
  }
  const text = pdfSafeText(block.text || '')
  const indent = (block.indent || 0) * 18
  if (block.variant === 'heading') {
    doc.moveDown(0.45)
    doc.font('Times-Bold').fontSize(12).text(text, { indent })
    return
  }
  if (block.variant === 'name') {
    doc.font('Times-Bold').fontSize(12).text(text, { indent })
    return
  }
  if (block.variant === 'closing') {
    doc.moveDown(0.6)
    doc.font('Times-Roman').fontSize(12).text(text, { indent })
    return
  }
  if (block.variant === 'signature') {
    doc.moveDown(1.1)
    doc.font('Times-Italic').fontSize(12).text(text, { indent })
    return
  }
  const tight = block.variant === 'tight' || block.variant === 'field'
  doc.font('Times-Roman').fontSize(12).text(text, { indent, lineGap: tight ? 1 : 3 })
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
  const letterPdf = await renderLetterPreviewPdf(layoutForLetter(letter))
  if (!isPdfBytes(letterPdf)) {
    throw new Error(`Letter "${title}" could not be saved as a PDF.`)
  }
  if (!attachments.length) return letterPdf
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
  const saved = new Uint8Array(await doc.save())
  if (!isPdfBytes(saved)) {
    throw new Error(`Letter "${title}" could not be saved as a PDF.`)
  }
  return saved
}
