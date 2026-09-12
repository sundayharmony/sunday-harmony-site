import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { disputeLetterDownloadUrl } from '../dispute-letters/client-api'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('dispute letter downloads and preview', () => {
  it('defaults individual downloads to docx', () => {
    assert.match(disputeLetterDownloadUrl('sess', 'letter-1'), /format=docx/)
    assert.doesNotMatch(disputeLetterDownloadUrl('sess', 'letter-1'), /format=txt/)
  })

  it('omits txt downloads and keeps a docx ZIP on the result step', () => {
    const ui = source('src/components/dispute-letters/DisputeLettersResultStep.tsx')
    const downloadRoute = source(
      'src/app/api/admin/dispute-letters/[id]/letters/[letterId]/download/route.ts'
    )
    assert.doesNotMatch(ui, /Download \.txt/)
    assert.doesNotMatch(ui, /format.*txt/)
    assert.match(ui, /Download all \(ZIP\)/)
    assert.match(ui, /disputeLettersZipUrl/)
    assert.match(ui, /Download \.docx/)
    assert.match(ui, /format = 'docx'|format === 'docx'|['"]docx['"]/)
    assert.match(ui, /letter-page/)
    assert.match(ui, /letter-header/)
    assert.match(ui, /active\.preview/)
    assert.match(ui, /Page 1\/1/)
    assert.match(downloadRoute, /searchParams\.get\('format'\) \|\| 'docx'/)
  })

  it('styles the preview like the Word page', () => {
    const css = source('src/components/dispute-letters/letter-preview.css')
    assert.match(css, /width:\s*8\.5in/)
    assert.match(css, /min-height:\s*11in/)
    assert.match(css, /padding:\s*1in/)
    assert.match(css, /Times New Roman/)
    assert.match(css, /font-size:\s*12pt/)
  })
})
