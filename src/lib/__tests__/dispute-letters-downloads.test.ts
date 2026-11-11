import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, it } from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { disputeLetterDownloadUrl } from '../dispute-letters/client-api'
import { zipErrorLabel } from '../dispute-letters/dispute-lifecycle'
import {
  publicLetterFailure,
  letterInlineParts,
  renderLetterPdfWithIdentity,
  renderLetterPreviewPdf,
} from '../dispute-letters/letter-pdf-render'
import { isPdfBytes } from '../dispute-letters/letter-zip'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

function pdfVisibleText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString('latin1')
  const parts = [raw]
  for (const match of raw.matchAll(/\/Length\s+(\d+)/g)) {
    const after = raw.slice(match.index, match.index + 120)
    const stream = after.match(/stream\r?\n/)
    if (!stream || stream.index === undefined) continue
    const start = match.index + stream.index + stream[0].length
    const slice = Buffer.from(raw.slice(start, start + Number(match[1])), 'latin1')
    try {
      parts.push(inflateSync(slice).toString('latin1'))
    } catch {
      // Uncompressed or not Flate.
    }
  }
  return parts.join('\n')
}

describe('dispute letter downloads and preview', () => {
  it('defaults individual downloads to pdf', () => {
    assert.match(disputeLetterDownloadUrl('sess', 'letter-1'), /format=pdf/)
    assert.doesNotMatch(disputeLetterDownloadUrl('sess', 'letter-1'), /format=txt/)
  })

  it('omits txt downloads and keeps a pdf ZIP on the result step', () => {
    const ui = source('src/components/dispute-letters/DisputeLettersResultStep.tsx')
    const downloadRoute = source(
      'src/app/api/admin/dispute-letters/[id]/letters/[letterId]/download/route.ts'
    )
    const zipRoute = source('src/app/api/admin/dispute-letters/[id]/letters/download-zip/route.ts')
    assert.doesNotMatch(ui, /Download \.txt/)
    assert.doesNotMatch(ui, /format.*txt/)
    assert.match(ui, /zipDownloadButtonLabel/)
    assert.match(ui, /downloadDisputeLettersZip/)
    assert.match(ui, /Confirm All Letters Sent/)
    assert.match(ui, /confirmLetterPackageSent/)
    assert.doesNotMatch(ui, /Mark sent/)
    assert.match(ui, /Download \.pdf/)
    assert.match(ui, /format = 'pdf'|format === 'pdf'|['"]pdf['"]/)
    assert.match(ui, /letter-page/)
    assert.match(ui, /letter-header/)
    assert.match(ui, /letterLayout/)
    assert.match(ui, /Page 1\/1/)
    assert.match(downloadRoute, /searchParams\.get\('format'\) \|\| 'pdf'/)
    assert.match(downloadRoute, /readStoredLetterDocxForSession/)
    assert.match(downloadRoute, /PDF is not ready yet/)
    assert.doesNotMatch(downloadRoute, /fetchLetterPdfForInteractiveDownload/)
    assert.doesNotMatch(downloadRoute, /\/internal\/letters\//)
    assert.doesNotMatch(downloadRoute, /\/download\?format/)
    assert.doesNotMatch(zipRoute, /download\.zip/)
    assert.match(zipRoute, /openReadyLetterPackageZip/)
    assert.match(zipRoute, /getOrBuildLetterPackageZip/)
    assert.match(zipRoute, /maxDuration = 120/)
    assert.doesNotMatch(zipRoute, /buildLetterPacketZipFiles/)
    assert.doesNotMatch(zipRoute, /markLetterSent/)
    assert.doesNotMatch(zipRoute, /sent_at/)
    assert.match(ui, /same letter PDFs as Download \.pdf|photo ID, proof of residence, and Social Security card/i)
    assert.match(ui, /zipReadyLabel|zipReady/)
    assert.match(ui, /zipError/)
    assert.match(ui, /zipErrorLabel/)
    assert.match(ui, /disputeLetterDownloadUrl/)
    assert.doesNotMatch(ui, /PDF is not ready yet/)
    const clientApi = source('src/lib/dispute-letters/client-api.ts')
    assert.match(clientApi, /downloadDisputeLettersZip/)
    assert.match(clientApi, /prepareDisputeLettersZip/)
    assert.match(clientApi, /waitForLetterPackageZip/)
    assert.match(clientApi, /DISPUTE_LETTERS_ZIP_CLIENT_TIMEOUT_MS/)
    assert.match(clientApi, /disputeLettersZipUrl/)
    const identity = source('src/lib/dispute-letters/letter-identity-attachments.ts')
    assert.match(identity, /LETTER_DOCX_FETCH_CONCURRENCY/)
    assert.match(identity, /mapWithConcurrency/)
    assert.match(identity, /withRetries/)
    assert.match(identity, /fetchLetterDocxFilesForZip/)
    assert.match(identity, /fetchLetterPdfForInteractiveDownload/)
    assert.match(identity, /include_evidence=false|includeEvidence: false/)
    const packageZip = source('src/lib/dispute-letters/letter-package-zip.ts')
    assert.match(packageZip, /prepareLetterPackageZip/)
    assert.match(packageZip, /loadPrebuiltLetterPackageZip/)
    assert.match(packageZip, /openReadyLetterPackageZip/)
    assert.match(packageZip, /getOrBuildLetterPackageZip/)
    assert.match(packageZip, /assembleLetterDocxFiles/)
    assert.match(packageZip, /renderLetterPdfWithIdentity/)
    assert.match(packageZip, /storeGeneratedLetterDocx/)
    assert.match(packageZip, /buildAndStoreLetterPdf/)
    assert.doesNotMatch(packageZip, /loadStoredEvidenceAttachments/)
    assert.doesNotMatch(packageZip, /fetchAccountEvidence/)
    assert.doesNotMatch(packageZip, /\/account-evidence/)
    assert.doesNotMatch(packageZip, /fetchLetterPdfForPackageZip/)
    assert.doesNotMatch(packageZip, /\/download\?format/)
    assert.match(downloadRoute, /buildAndStoreLetterPdf/)
    assert.doesNotMatch(downloadRoute, /account-evidence/)
    assert.doesNotMatch(zipRoute, /account-evidence/)
    assert.doesNotMatch(zipRoute, /\/download\?format/)
    assert.match(packageZip, /isStoredLetterDocxPath/)
    assert.match(packageZip, /buildLetterZipFiles/)
    assert.match(packageZip, /recordLetterPackageDownload/)
    assert.match(packageZip, /\.pdf/)
    const prepareRoute = source('src/app/api/admin/dispute-letters/[id]/letters/prepare-zip/route.ts')
    assert.match(prepareRoute, /prepareLetterPackageZip/)
    assert.match(prepareRoute, /maxDuration = 120/)
    const generateRoute = source('src/app/api/admin/dispute-letters/[id]/generate/route.ts')
    assert.match(generateRoute, /prepareLetterPackageZip/)
    assert.match(generateRoute, /after\(/)
    assert.match(generateRoute, /missing_letter_identity/)
    assert.match(generateRoute, /letterIdentityBypassAllowed/)
    assert.match(generateRoute, /bypass_missing_identity|canBypass/)
    const panel = source('src/components/dispute-letters/DisputeRoundsPanel.tsx')
    assert.match(panel, /downloadDisputeLettersZip/)
    assert.match(panel, /zipDownloadButtonLabel|Building ZIP|Downloading/)
    assert.match(panel, /zipReadyLabel/)
  })

  it('prints the cursive signature and account titles without asterisks', async () => {
    assert.deepEqual(letterInlineParts('**MERRICK BANK CORP**'), [{ bold: true, text: 'MERRICK BANK CORP' }])
    assert.equal(letterInlineParts('**ALLY** still open').some((part) => part.text.includes('**')), false)

    const bytes = await renderLetterPreviewPdf({
      date: 'November 10, 2026',
      blocks: [
        { kind: 'line', text: 'Equifax Information Services LLC', variant: 'name' },
        { kind: 'line', text: '**MERRICK BANK CORP**', variant: 'tight' },
        { kind: 'line', text: 'I dispute this account.', variant: 'body' },
        { kind: 'line', text: 'Respectfully,', variant: 'closing' },
        { kind: 'line', text: 'Essence Trice', variant: 'signature' },
      ],
    })
    assert.equal(isPdfBytes(bytes), true)
    const printed = pdfVisibleText(bytes)
    const readable = `${printed}\n${[...printed.matchAll(/<([0-9A-Fa-f]{4,})>/g)]
      .map((match) =>
        match[1].replace(/([0-9A-Fa-f]{2})/g, (_pair, hex: string) => {
          const code = parseInt(hex, 16)
          return code >= 32 && code < 127 ? String.fromCharCode(code) : ''
        })
      )
      .join('')}`
    const page = printed
      .split('\n')
      .filter((part) => part.includes('TJ'))
      .join('\n')
    const visible = [...page.matchAll(/<([0-9A-Fa-f]{2,})>/g)]
      .map((match) =>
        match[1]
          .replace(/(..)/g, (_pair, hex: string) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/[^\x20-\x7E]/g, '')
      )
      .join('')
    assert.equal(visible.includes('**'), false)
    assert.match(visible, /MERRICK BANK CORP/)
    assert.match(visible, /Essence Trice/)
    assert.match(readable, /GreatVibes/)
    assert.match(readable, /Page 1 of 1/)
    assert.match(readable, /November 10, 2026/)

    const extra = await PDFDocument.create()
    extra.addPage()
    const merged = await renderLetterPdfWithIdentity(
      {
        title: 'Experian',
        preview: {
          date: 'November 10, 2026',
          blocks: [{ kind: 'line', text: 'Hello', variant: 'body' }],
        },
      },
      [{ zipName: 'Government Photo ID.pdf', data: new Uint8Array(await extra.save()), mimeType: 'application/pdf' }]
    )
    assert.equal(isPdfBytes(merged), true)
    assert.ok((await PDFDocument.load(merged)).getPageCount() >= 2)
    const mergedText = pdfVisibleText(merged)
    const mergedReadable = `${mergedText}\n${[...mergedText.matchAll(/<([0-9A-Fa-f]{4,})>/g)]
      .map((match) =>
        match[1].replace(/([0-9A-Fa-f]{2})/g, (_pair, hex: string) => {
          const code = parseInt(hex, 16)
          return code >= 32 && code < 127 ? String.fromCharCode(code) : ''
        })
      )
      .join('')}`
    assert.match(mergedReadable, /Page 1 of 2/)
    assert.match(mergedReadable, /Page 2 of 2/)

    const html = '<!DOCTYPE html><html><title>Just a moment...</title>'
    assert.equal(
      publicLetterFailure(new Error(html), 'Letter "Experian" could not be saved as a PDF.'),
      'Letter "Experian" could not be saved as a PDF.'
    )
    assert.equal(zipErrorLabel(html), 'ZIP needs rebuild')
    assert.doesNotMatch(zipErrorLabel(html), /DOCTYPE|Just a moment/)
  })

  it('styles the preview like the printed letter page', () => {
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
    assert.match(panel, /zipDownloadButtonLabel/)
    assert.match(panel, /Photo ID, proof of residence, and Social Security card are in each letter/)
    assert.doesNotMatch(panel, /ITEM_OUTCOMES/)
    assert.doesNotMatch(panel, /Mark sent/)
    assert.match(panel, /BUREAU_OUTCOME_STATUSES/)
    assert.match(lifecycle, /confirmLetterPackageSent/)
    assert.match(lifecycle, /confirmAllSent/)
  })
})
