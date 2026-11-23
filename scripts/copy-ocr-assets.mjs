// Copies the browser OCR files (Tesseract worker/core/English data and the pdf.js worker)
// into public/ocr so the admin's browser loads them from this site, not a CDN.
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const out = 'public/ocr'
const nm = 'node_modules'
if (!existsSync(join(nm, 'tesseract.js'))) process.exit(0)
mkdirSync(join(out, 'core'), { recursive: true })
mkdirSync(join(out, 'lang'), { recursive: true })
cpSync(join(nm, 'tesseract.js/dist/worker.min.js'), join(out, 'worker.min.js'))
for (const name of ['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm']) {
  for (const ext of ['.wasm', '.wasm.js']) cpSync(join(nm, 'tesseract.js-core', name + ext), join(out, 'core', name + ext))
}
cpSync('scripts/ocr-data/eng.traineddata.gz', join(out, 'lang/eng.traineddata.gz'))
cpSync(join(nm, 'pdfjs-dist/build/pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'))
