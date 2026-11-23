import { PDFDocument } from 'pdf-lib'

/** Page width for screenshots in a combined report: US Letter, so the OCR service renders every page alike. */
const PAGE_WIDTH_PT = 612
/** PDF pages cannot be taller than 14,400pt. */
const MAX_PAGE_HEIGHT_PT = 14400

export type ReportPart = { name: string; type: string; bytes: Uint8Array }

export function isPdfPart(part: Pick<ReportPart, 'name' | 'type'>): boolean {
  return part.type === 'application/pdf' || /\.pdf$/i.test(part.name)
}

export function isPngOrJpeg(part: Pick<ReportPart, 'name' | 'type'>): 'png' | 'jpeg' | null {
  if (part.type === 'image/png' || /\.png$/i.test(part.name)) return 'png'
  if (/^image\/jpe?g$/.test(part.type) || /\.jpe?g$/i.test(part.name)) return 'jpeg'
  return null
}

/** Natural name order, so "Screenshot 2" comes before "Screenshot 10". */
export function sortReportParts<T extends { name: string }>(parts: T[]): T[] {
  return [...parts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
}

export function combinedReportName(names: string[]): string {
  const stem = (names[0] || 'Credit report').replace(/\.[^.]+$/, '').trim() || 'Credit report'
  return names.length > 1 ? `${stem} (${names.length} files combined).pdf` : `${stem}.pdf`
}

/**
 * One PDF from screenshots and partial PDFs, in the order given. Images are
 * embedded at full resolution; the OCR service reads them locally page by page.
 * Parts must already be PDF, PNG or JPEG bytes.
 */
export async function combineReportParts(parts: ReportPart[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const part of parts) {
    if (isPdfPart(part)) {
      const src = await PDFDocument.load(part.bytes, { ignoreEncryption: true })
      const pages = await out.copyPages(src, src.getPageIndices())
      pages.forEach((page) => out.addPage(page))
      continue
    }
    const kind = isPngOrJpeg(part)
    if (!kind) throw new Error(`${part.name} is not a PDF, PNG or JPEG file`)
    const image = kind === 'png' ? await out.embedPng(part.bytes) : await out.embedJpg(part.bytes)
    let width = PAGE_WIDTH_PT
    let height = (image.height / image.width) * width
    if (height > MAX_PAGE_HEIGHT_PT) {
      width = (MAX_PAGE_HEIGHT_PT / height) * width
      height = MAX_PAGE_HEIGHT_PT
    }
    const page = out.addPage([width, height])
    page.drawImage(image, { x: 0, y: 0, width, height })
  }
  return out.save()
}

/** Browser only: turn WEBP, HEIC (Safari), GIF, BMP and other images into PNG bytes. */
async function toPngBytes(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} could not be opened. Save it as PNG, JPG or PDF and try again.`)
  })
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot convert images')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error(`${file.name} could not be converted`)
  return new Uint8Array(await blob.arrayBuffer())
}

/** True when the file can be uploaded as-is (one PDF, PNG, JPEG, HTML, DOCX or text file). */
export function canUploadAsIs(files: File[]): boolean {
  if (files.length !== 1) return false
  const f = files[0]
  if (isPdfPart(f) || isPngOrJpeg(f)) return true
  return !f.type.startsWith('image/')
}

/** Browser only: several screenshots or page PDFs of one report become one PDF file. */
export async function combineReportFiles(files: File[]): Promise<File> {
  const ordered = sortReportParts(files)
  const parts: ReportPart[] = []
  for (const file of ordered) {
    if (isPdfPart(file) || isPngOrJpeg(file)) {
      parts.push({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) })
    } else if (file.type.startsWith('image/') || /\.(webp|heic|heif|gif|bmp|tiff?)$/i.test(file.name)) {
      parts.push({ name: file.name, type: 'image/png', bytes: await toPngBytes(file) })
    } else {
      throw new Error(`${file.name}: only PDFs and images can be combined. Upload other files one at a time.`)
    }
  }
  const bytes = await combineReportParts(parts)
  return new File([bytes as BlobPart], combinedReportName(ordered.map((f) => f.name)), { type: 'application/pdf' })
}
