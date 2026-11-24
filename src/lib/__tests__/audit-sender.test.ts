import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAudit } from '../icp-audit'
import { renderAuditFollowUp } from '../outreach/audit-email'
import { buildAuditMime, isSendDay, shouldPauseForBounces, warmupCap } from '../outreach/audit-sender'

describe('audit sender rules', () => {
  it('sends Tue–Thu only, in Eastern time', () => {
    assert.equal(isSendDay(new Date('2026-11-24T14:17:00Z')), true) // Tue 9:17 ET
    assert.equal(isSendDay(new Date('2026-11-27T14:17:00Z')), false) // Fri
    assert.equal(isSendDay(new Date('2026-11-25T03:00:00Z')), true) // Tue 10pm ET, still Tuesday
  })

  it('warms up from 75 by 25% per send day, with a ceiling', () => {
    assert.equal(warmupCap(0), 75)
    assert.equal(warmupCap(1), 94)
    assert.equal(warmupCap(2), 117)
    assert.equal(warmupCap(30), 500)
  })

  it('pauses only above 3% bounces on a real batch', () => {
    assert.equal(shouldPauseForBounces(75, 2), false)
    assert.equal(shouldPauseForBounces(75, 3), true)
    assert.equal(shouldPauseForBounces(5, 1), false)
  })

  it('builds a plain MIME message from sales@ with one-click unsubscribe and no attachment', () => {
    const audit = buildAudit({ id: 'l1', business: 'Acme Auto', location_text: 'Norfolk, VA', icp_score: 72, icp_data: { gaps: ['No website'], offer: 'business_launch', place: { rating: 4.8, reviewCount: 120 } } })
    const email = renderAuditFollowUp({ step: 2, audit, auditUrl: 'https://www.sundayharmony.com/audit/x', unsubscribeUrl: 'https://www.sundayharmony.com/unsubscribe/abcdefghijklmnop1234', firstSubject: 'A quick look at Acme Auto' })
    assert.equal(email.subject, 'Re: A quick look at Acme Auto')
    assert.match(email.text, /The first fix I would make: your Google listing has no website/)
    assert.match(email.text, /PO Box 1011/)
    const mime = buildAuditMime({ to: 'owner@acme.com', email, unsubscribeUrl: 'https://www.sundayharmony.com/unsubscribe/abcdefghijklmnop1234', boundary: 'b1' })
    assert.match(mime, /^From: Sunday Harmony <sales@sundayharmony\.com>/)
    assert.match(mime, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/)
    assert.doesNotMatch(mime, /Content-Disposition: attachment/)
    const last = renderAuditFollowUp({ step: 3, audit, auditUrl: 'https://www.sundayharmony.com/audit/x', unsubscribeUrl: 'https://www.sundayharmony.com/unsubscribe/abcdefghijklmnop1234', firstSubject: 'A quick look at Acme Auto' })
    assert.match(last.text, /Last note from me/)
    assert.doesNotMatch(last.text, /\$\s?\d/)
  })
})
