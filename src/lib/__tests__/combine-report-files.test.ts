import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import {
  combineReportParts,
  combinedReportName,
  isPngOrJpeg,
  sortReportParts,
} from '../dispute-letters/combine-report-files'

// 1x1 PNG
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
)

describe('combine report files', () => {
  it('puts screenshots and PDF pages into one PDF in order', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage([612, 792])
    pdf.addPage([612, 792])
    const pagesPdf = await pdf.save()
    const out = await combineReportParts([
      { name: 'shot 1.png', type: 'image/png', bytes: PNG },
      { name: 'pages.pdf', type: 'application/pdf', bytes: pagesPdf },
      { name: 'shot 2.png', type: 'image/png', bytes: PNG },
    ])
    const doc = await PDFDocument.load(out)
    assert.equal(doc.getPageCount(), 4)
    assert.equal(Math.round(doc.getPage(0).getWidth()), 612)
  })

  it('rejects files that are not PDF, PNG or JPEG', async () => {
    await assert.rejects(combineReportParts([{ name: 'a.webp', type: 'image/webp', bytes: PNG }]))
  })

  it('sorts screenshots in natural order and keeps the bureau in the name', () => {
    const sorted = sortReportParts([{ name: 'Shot 10.png' }, { name: 'Shot 2.png' }, { name: 'shot 1.png' }])
    assert.deepEqual(sorted.map((p) => p.name), ['shot 1.png', 'Shot 2.png', 'Shot 10.png'])
    assert.equal(combinedReportName(['John Experian 1.png', 'x.png']), 'John Experian 1 (2 files combined).pdf')
    assert.equal(isPngOrJpeg({ name: 'a.JPG', type: '' }), 'jpeg')
  })
})
