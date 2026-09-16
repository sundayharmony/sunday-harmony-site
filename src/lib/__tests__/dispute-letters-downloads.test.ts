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
    const zipRoute = source('src/app/api/admin/dispute-letters/[id]/letters/download-zip/route.ts')
    assert.doesNotMatch(ui, /Download \.txt/)
    assert.doesNotMatch(ui, /format.*txt/)
    assert.match(ui, /Download all \(ZIP\)/)
    assert.match(ui, /disputeLettersZipUrl/)
    assert.match(ui, /Confirm All Letters Sent/)
    assert.match(ui, /confirmLetterPackageSent/)
    assert.doesNotMatch(ui, /Mark sent/)
    assert.match(ui, /Download \.docx/)
    assert.match(ui, /format = 'docx'|format === 'docx'|['"]docx['"]/)
    assert.match(ui, /letter-page/)
    assert.match(ui, /letter-header/)
    assert.match(ui, /letterLayout/)
    assert.match(ui, /Page 1\/1/)
    assert.match(downloadRoute, /searchParams\.get\('format'\) \|\| 'docx'/)
    assert.doesNotMatch(zipRoute, /download\.zip/)
    assert.match(zipRoute, /zipFiles/)
    assert.match(zipRoute, /loadLetterIdentityAttachments/)
    assert.match(zipRoute, /fetchLetterDocxWithEnclosures/)
    assert.match(zipRoute, /buildLetterZipFiles/)
    assert.doesNotMatch(zipRoute, /buildLetterPacketZipFiles/)
    assert.match(zipRoute, /recordLetterPackageDownload/)
    assert.doesNotMatch(zipRoute, /markLetterSent/)
    assert.doesNotMatch(zipRoute, /sent_at/)
    assert.match(ui, /Photo ID and proof of address/)
    assert.match(downloadRoute, /fetchLetterDocxWithEnclosures/)
  })

  it('styles the preview like the Word page', () => {
    const css = source('src/components/dispute-letters/letter-preview.css')
    assert.match(css, /width:\s*8\.5in/)
    assert.match(css, /min-height:\s*11in/)
    assert.match(css, /padding:\s*0\.5in 1in 1in/)
    assert.match(css, /Times New Roman/)
    assert.match(css, /font-size:\s*12pt/)
  })

  it('uses a letter package confirm-all action instead of per-item dropdowns', () => {
    const panel = source('src/components/dispute-letters/DisputeRoundsPanel.tsx')
    const lifecycle = source('src/app/api/admin/dispute-letters/lifecycle/route.ts')
    assert.match(panel, /Confirm All Letters Sent/)
    assert.match(panel, /Letter package/)
    assert.match(panel, /Download again/)
    assert.match(panel, /Photo ID and proof of address are in each letter/)
    assert.doesNotMatch(panel, /ITEM_OUTCOMES/)
    assert.doesNotMatch(panel, /Mark sent/)
    assert.match(panel, /BUREAU_OUTCOME_STATUSES/)
    assert.match(lifecycle, /confirmLetterPackageSent/)
    assert.match(lifecycle, /confirmAllSent/)
  })
})
