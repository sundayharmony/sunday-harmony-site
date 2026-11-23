import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { auditToken, buildAudit, verifyAuditToken, type AuditLead } from '../icp-audit'
import { buildAuditPdf } from '../icp-audit-pdf'
import { auditEmailIssues, renderAuditEmail } from '../outreach/audit-email'
import { OUTREACH_MAILING_ADDRESS } from '../outreach/constants'

const lead: AuditLead = {
  id: '11111111-2222-3333-4444-555555555555',
  business: 'Acme Heating & Air',
  location_text: 'Austin, TX',
  icp_score: 72,
  icp_data: {
    gaps: ['Website not built for phones', 'No booking or quote form', 'Unknown gap'],
    offer: 'business_essentials',
    place: { rating: 4.8, reviewCount: 214 },
  },
}
const SECRET = 'test-secret'
const auditUrl = `https://www.sundayharmony.com/audit/${auditToken(lead.id, SECRET)}`
const unsubscribeUrl = 'https://www.sundayharmony.com/unsubscribe/abcdefghijklmnopqrstuvwxyz'

describe('icp audit', () => {
  it('maps known gaps to findings and names the next step', () => {
    const audit = buildAudit(lead)
    assert.equal(audit.findings.length, 2)
    assert.equal(audit.nextStep.name, 'Business Essentials')
    assert.match(audit.strengths[0], /4\.8 stars from 214 Google reviews/)
  })

  it('signs and verifies tokens', () => {
    const token = auditToken(lead.id, SECRET)
    assert.equal(verifyAuditToken(token, SECRET), lead.id)
    assert.equal(verifyAuditToken(token, 'other'), null)
    assert.equal(verifyAuditToken(`${lead.id}.bad`, SECRET), null)
    assert.equal(verifyAuditToken('nope', SECRET), null)
  })

  it('renders an email that passes pre-send checks', () => {
    const email = renderAuditEmail({ audit: buildAudit(lead), auditUrl, unsubscribeUrl, firstName: 'Sam' })
    assert.deepEqual(auditEmailIssues(email, { score: 72, suppressed: false, auditUrl }), [])
    assert.ok(email.html.includes(OUTREACH_MAILING_ADDRESS))
    assert.ok(email.text.includes('PO Box 1011, Jersey City, NJ 07304'))
    assert.ok(email.html.includes('&amp;'), 'business name is escaped')
    assert.ok(!/Mac\b/.test(email.text), 'signed as Sunday Harmony')
  })

  it('blocks low scores, suppressed leads and missing unsubscribe', () => {
    const email = renderAuditEmail({ audit: buildAudit(lead), auditUrl, unsubscribeUrl: 'https://x/unsubscribe/preview-disabled' })
    const issues = auditEmailIssues(email, { score: 49, suppressed: true, auditUrl })
    for (const i of ['missing_unsubscribe', 'score_below_50', 'suppressed']) assert.ok(issues.includes(i), i)
  })

  it('builds a PDF', async () => {
    const pdf = await buildAuditPdf(buildAudit(lead), { auditUrl, bookUrl: 'https://www.sundayharmony.com/book' })
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  })
})

describe('audit email copy', () => {
  it('skips junk first names and stays short with one plain finding', () => {
    const one = { ...lead, icp_data: { ...lead.icp_data, gaps: ['No website'] } }
    const email = renderAuditEmail({ audit: buildAudit(one), auditUrl, unsubscribeUrl, firstName: 'Not' })
    assert.match(email.text, /^Hi,\n/)
    assert.match(email.text, /your Google listing has no website/)
    assert.match(email.text, /the fix and what we would do first/)
    const body = email.text.split('Sunday Harmony\n')[0]
    assert.ok(body.replace(auditUrl, '').split(/\s+/).length <= 80, 'under 80 words')
  })
})
