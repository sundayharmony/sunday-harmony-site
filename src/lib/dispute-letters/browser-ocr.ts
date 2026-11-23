/**
 * Browser only. Reads screenshot and scanned credit reports on the admin's own computer
 * (Tesseract + pdf.js, served from /ocr), so the small Render instance only parses text.
 * Nothing here sends the file anywhere; the caller uploads the text with the report.
 */

const OCR_BASE = '/ocr'
// Screenshot PDFs embed ~2,100px-wide images; reading at or above that keeps small text legible.
const TARGET_WIDTH_PX = 2400
const TILE_HEIGHT_PX = 2200
const TILE_OVERLAP_PX = 60
const MAX_PAGES = 40
/** Below this many characters per page, a PDF is treated as pictures. */
const MIN_TEXT_CHARS_PER_PAGE = 80

type Say = (message: string) => void

const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/i

export function isPictureFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.startsWith('image/') || IMAGE_RE.test(file.name)
}

export function isPdfFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/** True when a PDF's own text is too thin or garbled to parse (so it needs OCR). */
export function textLayerNeedsOcr(pageTexts: string[]): boolean {
  if (!pageTexts.length) return true
  const text = pageTexts.join('\n').replace(/\(cid:\d+\)/g, '#')
  const chars = text.replace(/\s/g, '')
  if (chars.length / pageTexts.length < MIN_TEXT_CHARS_PER_PAGE) return true
  if (chars.length < 200) return false
  const letters = chars.replace(/[^A-Za-z]/g, '').length
  return letters / chars.length < 0.35
}

/** Vertical strips [top, bottom) covering a tall page, overlapping slightly. */
export function tileRows(height: number): [number, number][] {
  if (height <= TILE_HEIGHT_PX + TILE_OVERLAP_PX) return [[0, height]]
  const rows: [number, number][] = []
  for (let top = 0; top < height; top += TILE_HEIGHT_PX) {
    rows.push([top, Math.min(height, top + TILE_HEIGHT_PX + TILE_OVERLAP_PX)])
  }
  return rows
}

type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}

async function startWorker(say: Say): Promise<OcrWorker> {
  say('Loading the screenshot reader (first time can take a minute)…')
  const { createWorker } = await import('tesseract.js')
  return (await createWorker('eng', 1, {
    workerPath: `${OCR_BASE}/worker.min.js`,
    corePath: `${OCR_BASE}/core`,
    langPath: `${OCR_BASE}/lang`,
    workerBlobURL: false,
    gzip: true,
  })) as unknown as OcrWorker
}

async function readCanvas(worker: OcrWorker, canvas: HTMLCanvasElement): Promise<string> {
  const parts: string[] = []
  for (const [top, bottom] of tileRows(canvas.height)) {
    const strip = document.createElement('canvas')
    strip.width = canvas.width
    strip.height = bottom - top
    strip.getContext('2d')!.drawImage(canvas, 0, top, canvas.width, bottom - top, 0, 0, canvas.width, bottom - top)
    const { data } = await worker.recognize(strip)
    if (data.text.trim()) parts.push(data.text)
  }
  return parts.join('\n')
}

async function pdfPages(file: File) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `${OCR_BASE}/pdf.worker.min.mjs`
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
}

/**
 * Text for a screenshot or scanned report, read in this browser. Returns '' when the file
 * already carries readable text (the server reads it as usual) or is not a PDF/picture.
 */
export async function readReportPicturesInBrowser(file: File, say: Say): Promise<string> {
  if (isPictureFile(file)) {
    const worker = await startWorker(say)
    try {
      say('Reading the screenshot on this computer…')
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, TARGET_WIDTH_PX / bitmap.width) || 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      return await readCanvas(worker, canvas)
    } finally {
      await worker.terminate()
    }
  }
  if (!isPdfFile(file)) return ''

  const pdf = await pdfPages(file)
  try {
    const count = Math.min(pdf.numPages, MAX_PAGES)
    const pageTexts: string[] = []
    for (let n = 1; n <= count; n += 1) {
      const content = await (await pdf.getPage(n)).getTextContent()
      pageTexts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    if (!textLayerNeedsOcr(pageTexts)) return ''

    const worker = await startWorker(say)
    try {
      const out: string[] = []
      for (let n = 1; n <= count; n += 1) {
        say(`Reading page ${n} of ${count} on this computer…`)
        const page = await pdf.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: Math.min(200 / 72, TARGET_WIDTH_PX / base.width) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise
        out.push(await readCanvas(worker, canvas))
        page.cleanup()
      }
      return out.join('\n\n')
    } finally {
      await worker.terminate()
    }
  } finally {
    await pdf.destroy()
  }
}
