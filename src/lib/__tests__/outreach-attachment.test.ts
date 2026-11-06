import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { loadCompanyPresentationPdf, resolveCompanyPresentationPdf } from '../outreach/attachment'
import { OUTREACH_ATTACHMENT_PUBLIC_PATH } from '../outreach/constants'

const REPO_PDF = readFileSync(join(process.cwd(), 'public/sales-materials/company-presentation.pdf'))

describe('outreach presentation attachment', () => {
  it('loads the company presentation PDF from the repo public folder', () => {
    const buf = loadCompanyPresentationPdf()
    assert.ok(buf)
    assert.equal(buf.subarray(0, 5).toString('utf8'), '%PDF-')
    assert.equal(buf.length, REPO_PDF.length)
  })

  it('reads a PDF from the flattened sales-materials path some serverless traces use', () => {
    const dir = mkdtempSync(join(tmpdir(), 'outreach-pdf-alt-'))
    mkdirSync(join(dir, 'sales-materials'))
    writeFileSync(join(dir, 'sales-materials/company-presentation.pdf'), REPO_PDF)
    const buf = loadCompanyPresentationPdf(dir)
    assert.ok(buf)
    assert.equal(buf.length, REPO_PDF.length)
  })

  it('traces the PDF into Vercel outreach functions', () => {
    const nextConfig = readFileSync('next.config.js', 'utf8')
    assert.match(nextConfig, /outputFileTracingIncludes/)
    assert.match(nextConfig, /\/api\/admin\/outreach/)
    assert.match(nextConfig, /\/api\/internal\/outreach-dispatch/)
    assert.match(nextConfig, /public\/sales-materials\/company-presentation\.pdf/)
  })

  it('falls back to the public URL when the serverless disk copy is missing', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'outreach-pdf-'))
    const previousUrl = process.env.NEXTAUTH_URL
    const previousSite = process.env.NEXT_PUBLIC_SITE_URL
    const previousFetch = globalThis.fetch
    process.env.NEXTAUTH_URL = 'https://www.sundayharmony.com'
    delete process.env.NEXT_PUBLIC_SITE_URL
    let requested = ''
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response(REPO_PDF, { status: 200, headers: { 'content-type': 'application/pdf' } })
    }) as typeof fetch
    try {
      const buf = await resolveCompanyPresentationPdf(empty)
      assert.ok(buf)
      assert.equal(buf.length, REPO_PDF.length)
      assert.equal(requested, `https://www.sundayharmony.com${OUTREACH_ATTACHMENT_PUBLIC_PATH}`)
    } finally {
      globalThis.fetch = previousFetch
      if (previousUrl === undefined) delete process.env.NEXTAUTH_URL
      else process.env.NEXTAUTH_URL = previousUrl
      if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
      else process.env.NEXT_PUBLIC_SITE_URL = previousSite
    }
  })

  it('does not fetch localhost when the disk file is missing in local tests', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'outreach-pdf-local-'))
    const previousUrl = process.env.NEXTAUTH_URL
    const previousFetch = globalThis.fetch
    let called = false
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    globalThis.fetch = (async () => {
      called = true
      return new Response(REPO_PDF)
    }) as typeof fetch
    try {
      assert.equal(await resolveCompanyPresentationPdf(empty), null)
      assert.equal(called, false)
    } finally {
      globalThis.fetch = previousFetch
      if (previousUrl === undefined) delete process.env.NEXTAUTH_URL
      else process.env.NEXTAUTH_URL = previousUrl
    }
  })

  it('rejects a non-PDF public response', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'outreach-pdf-bad-'))
    const previousUrl = process.env.NEXTAUTH_URL
    const previousFetch = globalThis.fetch
    process.env.NEXTAUTH_URL = 'https://www.sundayharmony.com'
    globalThis.fetch = (async () => new Response('not-a-pdf', { status: 200 })) as typeof fetch
    try {
      assert.equal(await resolveCompanyPresentationPdf(empty), null)
    } finally {
      globalThis.fetch = previousFetch
      if (previousUrl === undefined) delete process.env.NEXTAUTH_URL
      else process.env.NEXTAUTH_URL = previousUrl
    }
  })
})
