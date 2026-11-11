import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { disputeLetterDownloadUrl } from '../dispute-letters/client-api'
import { zipErrorLabel } from '../dispute-letters/dispute-lifecycle'
import {
  publicLetterFailure,
  renderLetterPdfWithIdentity,
  renderLetterPreviewPdf,
} from '../dispute-letters/letter-pdf-render'
import {
  evidencePagesForLetter,
  interpretAccountEvidenceBody,
  letterBureauFromType,
  storedLetterNeedsRebuild,
} from '../dispute-letters/letter-account-evidence'
import { isPdfBytes } from '../dispute-letters/letter-zip'

function source(path: string) {
  return readFileSync(path, 'utf8')
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

  it('renders a stored PDF from the on-screen letter and keeps HTML out of errors', async () => {
    const bytes = await renderLetterPreviewPdf({
      date: 'November 10, 2026',
      blocks: [
        { kind: 'line', text: 'Equifax Information Services LLC', variant: 'name' },
        { kind: 'line', text: 'I dispute this account.', variant: 'body' },
        { kind: 'line', text: 'Respectfully,', variant: 'closing' },
        { kind: 'line', text: 'Essence Trice', variant: 'signature' },
      ],
    })
    assert.equal(isPdfBytes(bytes), true)

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

    const html = '<!DOCTYPE html><html><title>Just a moment...</title>'
    assert.equal(
      publicLetterFailure(new Error(html), 'Letter "Experian" could not be saved as a PDF.'),
      'Letter "Experian" could not be saved as a PDF.'
    )
    assert.equal(zipErrorLabel(html), 'ZIP needs rebuild')
    assert.doesNotMatch(zipErrorLabel(html), /DOCTYPE|Just a moment/)
  })

  it('appends account screenshot JPEGs and ignores an HTML evidence body', async () => {
    const jpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUXFRUYGBYYGBgYGBcYGBcYGBgYGBcYHSggGBolHRcVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAMBAAMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAADAAIEBQYBB//EABYBAQEBAAAAAAAAAAAAAAAAAAABAv/aAAwDAQACEQMRAD8A0QAAAAAAAAAAAf/Z',
      'base64'
    )
    const before = await renderLetterPreviewPdf({
      date: 'November 10, 2026',
      blocks: [{ kind: 'line', text: 'Letter body', variant: 'body' }],
    })
    const withShot = await renderLetterPdfWithIdentity(
      {
        title: 'Experian',
        preview: {
          date: 'November 10, 2026',
          blocks: [{ kind: 'line', text: 'Letter body', variant: 'body' }],
        },
      },
      [{ zipName: 'Account Evidence 1.jpg', data: new Uint8Array(jpeg), mimeType: 'image/jpeg' }]
    )
    assert.equal(isPdfBytes(withShot), true)
    const plainPages = (await PDFDocument.load(before)).getPageCount()
    const shotPages = (await PDFDocument.load(withShot)).getPageCount()
    assert.equal(shotPages, plainPages + 1)

    const html = '<!DOCTYPE html><title>Just a moment...</title>'
    const parsed = interpretAccountEvidenceBody(html, true)
    assert.equal(parsed.missing, true)
    assert.equal(parsed.files.length, 0)
    assert.equal(storedLetterNeedsRebuild(null), false)
    assert.equal(storedLetterNeedsRebuild({ attempted: true }), false)
    assert.equal(letterBureauFromType('bureau_experian'), 'EXP')
    const pages = evidencePagesForLetter(
      {
        attempted: true,
        missing: false,
        pages: [
          { page: 2, bureau: 'EQF', tradelineId: 'disc', path: 'sessions/s/evidence/page-2.jpg' },
          { page: 3, bureau: 'TUC', tradelineId: 'disc', path: 'sessions/s/evidence/page-3.jpg' },
          { page: 4, bureau: 'EXP', tradelineId: 'other', path: 'sessions/s/evidence/page-4.jpg' },
        ],
      },
      [{ tradeline_id: 'disc' }],
      'EQF'
    )
    assert.deepEqual(pages.map((page) => page.page), [2])
    assert.doesNotMatch(publicLetterFailure(new Error(html)), /DOCTYPE|Just a moment/)
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
