import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { MAX_CSP_REPORT_BYTES, readCspReport } from '../csp-report'

function loadSecurityHeaders(nodeEnv: 'development' | 'production') {
  const script = `
    const config = require('./next.config.js')
    config.headers().then((rules) => {
      const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]))
      process.stdout.write(JSON.stringify(headers))
    })
  `
  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: nodeEnv },
  })
  return JSON.parse(output) as Record<string, string>
}

describe('CSP and XSS hardening', () => {
  it('removes unsafe-eval in production but retains it for development HMR', () => {
    const production = loadSecurityHeaders('production')
    const development = loadSecurityHeaders('development')

    assert.doesNotMatch(production['Content-Security-Policy'], /'unsafe-eval'/)
    assert.match(development['Content-Security-Policy'], /'unsafe-eval'/)
    assert.equal(production['X-XSS-Protection'], '0')
  })

  it('restricts images and isolates the PDF worker CDN', () => {
    const csp = loadSecurityHeaders('production')['Content-Security-Policy']
    const imageDirective = csp.split('; ').find((part) => part.startsWith('img-src'))
    const workerDirective = csp.split('; ').find((part) => part.startsWith('worker-src'))

    assert.equal(imageDirective?.split(/\s+/).includes('https:'), false)
    assert.match(imageDirective || '', /https:\/\/\*\.supabase\.co/)
    assert.match(workerDirective || '', /https:\/\/cdn\.jsdelivr\.net/)
  })

  it('has no raw HTML sink in the dispute-letter preview', () => {
    const source = readFileSync(
      'src/app/admin/dispute-letters/[sessionId]/letters/page.tsx',
      'utf8'
    )
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
  })

  it('accepts valid CSP reports and rejects malformed or oversized bodies', async () => {
    const valid = new Request('https://example.test/api/csp-report', {
      method: 'POST',
      body: JSON.stringify({ 'csp-report': { 'blocked-uri': 'https://bad.test' } }),
    })
    assert.deepEqual(await readCspReport(valid), {
      'csp-report': { 'blocked-uri': 'https://bad.test' },
    })

    const malformed = new Request('https://example.test/api/csp-report', {
      method: 'POST',
      body: '{not-json',
    })
    assert.equal(await readCspReport(malformed), null)

    const oversized = new Request('https://example.test/api/csp-report', {
      method: 'POST',
      body: JSON.stringify({ report: 'x'.repeat(MAX_CSP_REPORT_BYTES) }),
    })
    assert.equal(await readCspReport(oversized), null)
  })
})
