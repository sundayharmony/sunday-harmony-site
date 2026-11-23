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

describe('groupReportFiles', () => {
  it('splits reports named for different bureaus and keeps unnamed screenshots together', async () => {
    const { groupReportFiles, bureauInFileName } = await import('../dispute-letters/combine-report-files')
    const names = (g: { name: string }[][]) => g.map((x) => x.map((f) => f.name))
    assert.deepEqual(
      names(groupReportFiles([{ name: 'Jo Experian 11-22.pdf' }, { name: 'Jo Equifax 11-22.pdf' }, { name: 'Jo Transunioin 11-22.pdf' }])),
      [['Jo Experian 11-22.pdf'], ['Jo Equifax 11-22.pdf'], ['Jo Transunioin 11-22.pdf']]
    )
    assert.deepEqual(names(groupReportFiles([{ name: 'shot1.png' }, { name: 'shot2.png' }])), [['shot1.png', 'shot2.png']])
    assert.deepEqual(
      names(groupReportFiles([{ name: 'TU page 1.pdf' }, { name: 'TU page 2.pdf' }, { name: 'Experian.pdf' }])),
      [['TU page 1.pdf', 'TU page 2.pdf'], ['Experian.pdf']]
    )
    assert.equal(bureauInFileName('Smith Experian Equifax TransUnion.pdf'), '')
    assert.equal(bureauInFileName('Credit Hero Score 9-7-2026.pdf'), '')
  })
})
