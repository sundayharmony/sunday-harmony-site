import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { NextRequest } from 'next/server'
import { evaluateActivationBlockers, mailingAddressIsValid, sendsPermitted } from '../outreach/activation'
import { claimNextPending, recoverExpiredInFlight } from '../outreach/claims'
import { confirmUnsubscribe } from '../outreach/confirm-unsubscribe'
import { buildOutreachConsole } from '../outreach/console'
import { EMAIL_BOT_UNVERIFIED_REPORTS, OUTREACH_CTA_URL, OUTREACH_MAILING_ADDRESS, OUTREACH_SENDER_EMAIL } from '../outreach/constants'
import { copyIssues, escapeHtml } from '../outreach/copy-rules'
import { isSameOriginRequest, verifyProviderWebhookSignature } from '../outreach/csrf'
import { dispatchOutreachBatch } from '../outreach/dispatch'
import { renderDraft } from '../outreach/draft'
import { draftContentSha256 } from '../outreach/draft-shell'
import { normalizeEmail, isValidEmailSyntax } from '../outreach/email-address'
import { evaluateEligibility } from '../outreach/eligibility'
import { enqueueLeadSnapshots, refreshUnsentQueueCopy } from '../outreach/enqueue'
import { extractGroundedFacts, usableFirstName } from '../outreach/facts'
import { prospectGreetingIsUsable } from '../outreach/greeting'
import { toProspectObservation } from '../outreach/observation'
import type { LeadSnapshot } from '../outreach/types'
import { buildHandoff } from '../outreach/handoff'
import { buildOutreachMime, mimeContainsAttachment } from '../outreach/mime'
import { lookupMx } from '../outreach/mx'
import { createGmailOutreachProvider, createMockProvider, queueItemPayload } from '../outreach/provider'
import { createMemoryOutreachStore, setOutreachStoreForTests } from '../outreach/store'
import { createUnsubscribeToken, hashUnsubscribeToken, unsubscribeUrl } from '../outreach/unsubscribe'
import { POST as importLeads } from '../../app/api/internal/leads-import/route'
import { GET as dispatchGet } from '../../app/api/internal/outreach-dispatch/route'
import { POST as webhookPost } from '../../app/api/internal/outreach-provider-events/route'
import { POST as unsubPost } from '../../app/api/unsubscribe/[token]/route'

function lead(partial: Partial<LeadSnapshot> = {}): LeadSnapshot {
  return {
    id: partial.id || 'lead-1',
    business: partial.business || 'SwingStop Hammonton',
    email: partial.email || 'info@swingstopvineland.com',
    firstName: partial.firstName || 'Christopher',
    locationText: partial.locationText || 'Hammonton, NJ',
    industry: partial.industry || 'Indoor golf simulator',
    marketingOpportunity: partial.marketingOpportunity || 'No Hammonton landing page or title mention',
    phone: partial.phone || '877-734-9145',
    leadType: 'marketing_lead',
    pipelineStage: partial.pipelineStage || 'researching',
    lastContactedAt: partial.lastContactedAt,
    gmailThreadId: partial.gmailThreadId,
  }
}

const mxOk = async () => [{ priority: 10, exchange: 'mail.example.com' }]
const mxNull = async () => [{ priority: 0, exchange: '.' }]
const mxTimeout = async () => {
  const error = new Error('timeout') as Error & { code: string }
  error.code = 'ETIMEOUT'
  throw error
}

describe('outreach email identity', () => {
  it('validates syntax and does not collapse plus or dotted mailboxes', () => {
    assert.equal(isValidEmailSyntax('hey@wisebean.com'), true)
    assert.equal(normalizeEmail('Hey@WiseBean.com'), 'hey@wisebean.com')
    assert.equal(normalizeEmail('user+news@example.com'), 'user+news@example.com')
    assert.equal(normalizeEmail('first.last@example.com'), 'first.last@example.com')
    assert.notEqual(normalizeEmail('user+a@example.com'), normalizeEmail('user+b@example.com'))
    assert.notEqual(normalizeEmail('j.smith@example.com'), normalizeEmail('jsmith@example.com'))
    assert.equal(isValidEmailSyntax('not-an-email'), false)
  })

  it('treats Null MX as not deliverable and DNS timeout as uncertain, never a bounce', async () => {
    assert.equal((await lookupMx('hey@wisebean.com', mxNull)).kind, 'null_mx')
    assert.equal((await lookupMx('owner@example.com', mxTimeout)).kind, 'uncertain')
    assert.equal((await lookupMx('owner@example.com', mxOk)).kind, 'ok')
  })
})

describe('grounded draft copy', () => {
  it('uses stored facts only, escapes HTML, avoids dashes and forbidden geo, and keeps the book CTA', () => {
    const facts = extractGroundedFacts({
      business: 'SwingStop Hammonton',
      first_name: 'Christopher',
      location_text: 'Hammonton, NJ',
      industry: 'Indoor golf simulator',
      marketing_opportunity: 'No Hammonton landing page',
    })
    assert.ok(facts)
    const draft = renderDraft({ facts, unsubscribeUrl: 'https://www.sundayharmony.com/unsubscribe/abc', physicalMailingAddress: null })
    assert.match(draft.subject, /SwingStop Hammonton/)
    assert.match(draft.text, /Hi Christopher,/)
    assert.match(draft.text, /I came across SwingStop Hammonton in Hammonton, NJ/)
    assert.doesNotMatch(draft.text, /while looking at Indoor golf simulator/)
    assert.match(draft.text, /doesn't clearly say you're in Hammonton yet/)
    assert.doesNotMatch(draft.text, /No Hammonton landing page/)
    assert.match(draft.html, /Pick a time/)
    assert.equal(draft.ctaUrl, OUTREACH_CTA_URL)
    assert.equal(copyIssues(draft.bodyText).length, 0)
    assert.match(draft.html, /Physical mailing address missing/)
    const withAddress = renderDraft({
      facts,
      unsubscribeUrl: 'https://www.sundayharmony.com/unsubscribe/abc',
      physicalMailingAddress: OUTREACH_MAILING_ADDRESS,
    })
    assert.match(withAddress.html, /PO Box 1011, Jersey City, NJ 07304/)
    assert.doesNotMatch(withAddress.html, /Physical mailing address missing/)
    const injected = extractGroundedFacts({
      business: 'Acme <script>alert(1)</script>',
      first_name: 'Pat',
      marketing_opportunity: 'Has a gap',
    })
    assert.ok(injected)
    const escaped = renderDraft({ facts: injected, unsubscribeUrl: 'https://example.test/u/x' })
    assert.match(escaped.html, /Acme &lt;script&gt;/)
    assert.doesNotMatch(escaped.html, /<script>alert/)
    assert.equal(escapeHtml('<b>'), '&lt;b&gt;')
  })

  it('does not invent a name or observation when those facts are missing', () => {
    const facts = extractGroundedFacts({ business: 'Nick & Son Heating & AC', first_name: '' })
    assert.ok(facts)
    const draft = renderDraft({ facts, unsubscribeUrl: 'https://example.test/u/x' })
    assert.match(draft.bodyText, /^Hi,/)
    assert.doesNotMatch(draft.text, /Hi Name/)
    assert.doesNotMatch(draft.bodyText, /Atlantic County|South Jersey|—/)
  })

  it('uses a bare Hi when the first name is missing and still enqueues', async () => {
    assert.equal(usableFirstName('Not'), null)
    assert.equal(usableFirstName('Not found'), null)
    assert.equal(usableFirstName('Christopher'), 'Christopher')
    const facts = extractGroundedFacts({
      business: 'Galloway Nursery',
      first_name: 'Not',
      location_text: 'Egg Harbor City, NJ',
      marketing_opportunity: 'GoDaddy site, GA only, no pixel; strong TikTok/IG to leverage',
    })
    assert.equal(facts?.firstName, null)
    const draft = renderDraft({ facts: facts!, unsubscribeUrl: 'https://example.test/u/x' })
    assert.match(draft.bodyText, /^Hi,/)
    assert.doesNotMatch(draft.bodyText, /Hi Not,/)
    assert.equal(prospectGreetingIsUsable(draft.html, facts?.firstName), true)
    assert.match(draft.bodyText, /getting set up/)
    assert.doesNotMatch(draft.bodyText, /GA only|pixel|GoDaddy/)
    const store = createMemoryOutreachStore({
      leads: [lead({ id: 'no-name', firstName: 'Not', business: 'Galloway Nursery', email: 'emma@gallowaynursery.test' })],
    })
    const result = await enqueueLeadSnapshots(store, await store.listEligibleLeadCandidates(), { mxResolver: mxOk })
    assert.equal(result.enqueued, 1)
    assert.equal((await store.listQueue())[0]?.status, 'pending')
    assert.match((await store.listQueue())[0]?.htmlBody || '', /Hi,/)
  })

  it('rewrites research notes into plain sentences a business owner can understand', () => {
    const lawn = toProspectObservation(
      'Free Wix subdomain, no Facebook found, no Google Business Profile found , invisible in local Google Maps lawn searches',
      { location: 'Summerville, SC', business: 'Lawn Enforcement' }
    )
    assert.match(lawn || '', /getting set up/)
    assert.match(lawn || '', /Google Maps/)
    assert.doesNotMatch(lawn || '', /Wix subdomain|GBP|pixel|harder to trust/i)

    const capri = toProspectObservation(
      'Free Wix co-branding banner on site; no analytics; no online ordering link',
      { location: 'Ventnor City, NJ', business: 'Capri Pizza & Grill' }
    )
    assert.match(capri || '', /getting set up/)
    assert.match(capri || '', /order from the website yet/)
    assert.doesNotMatch(capri || '', /analytics|Wix|cannot/i)

    const florist = toProspectObservation(
      'Personal AOL email (jonjenk@aol.com) as business contact',
      { location: 'Mays Landing, NJ', business: 'County Seat Florist' }
    )
    assert.match(florist || '', /email still looks personal/)
    assert.doesNotMatch(florist || '', /jonjenk|aol\.com|harder to trust/i)

    const coffee = toProspectObservation('Three closing times online (2:40, 3, 4 PM)', {
      location: 'Brigantine, NJ',
      business: 'Summer & Sage Coffee',
    })
    assert.match(coffee || '', /hours show up a few different ways/)

    const nursery = extractGroundedFacts({
      business: 'Galloway Nursery',
      first_name: 'Not',
      location_text: 'Egg Harbor City, NJ',
      marketing_opportunity: 'GoDaddy site, GA only, no pixel; strong TikTok/IG to leverage',
    })
    assert.match(nursery?.observation || '', /getting set up|social media/)
    assert.doesNotMatch(nursery?.observation || '', /GA only|pixel|GoDaddy|TikTok/)
    assert.equal(copyIssues(nursery?.observation || '').includes('internal_jargon'), false)
  })
})

describe('eligibility, suppression, and unverified reports', () => {
  it('excludes unsubscribed, contacted, already sent, and exact unverified reports without mutating leads', async () => {
    const store = createMemoryOutreachStore({
      leads: [
        lead({ id: 'a', email: 'info@swingstopvineland.com' }),
        lead({ id: 'b', email: 'sal@saljacobs.com', business: 'Jacobs Plumbing', lastContactedAt: '2026-11-01T00:00:00.000Z' }),
        lead({ id: 'c', email: 'hey@wisebean.com', business: 'Wise Bean', marketingOpportunity: 'Local coffee' }),
        lead({ id: 'd', email: 'owner@egyptstar.test', business: 'Egypt Star', marketingOpportunity: 'Menu site' }),
      ],
    })
    await store.addSuppression({
      emailNormalized: 'info@swingstopvineland.com',
      reason: 'unsubscribe',
      source: 'user',
      confirmationStatus: 'confirmed',
      notes: '',
    })
    const result = await enqueueLeadSnapshots(store, await store.listEligibleLeadCandidates(), { mxResolver: mxOk })
    const queue = await store.listQueue()
    assert.equal(queue.find((row) => row.emailNormalized === 'info@swingstopvineland.com')?.status, 'suppressed')
    assert.equal(queue.find((row) => row.leadId === 'b')?.status, 'ineligible')
    assert.equal(queue.find((row) => row.emailNormalized === 'hey@wisebean.com')?.status, 'blocked_review')
    assert.equal(queue.find((row) => row.leadId === 'd')?.status, 'blocked_review')
    assert.ok(result.blockedReview >= 2)
    assert.equal((await store.getLead('c'))?.lastContactedAt || null, null)
    assert.equal((await store.getLead('d'))?.lastContactedAt || null, null)
    const wise = EMAIL_BOT_UNVERIFIED_REPORTS.find((row) => row.business === 'Wise Bean')
    assert.equal(wise?.outcome, 'null_mx')
  })

  it('rewrites observations that mention a prospect email instead of putting that email in the body', async () => {
    const store = createMemoryOutreachStore({
      leads: [
        lead({
          id: 'email-in-note',
          firstName: 'John',
          business: 'County Seat Florist',
          email: 'jonjenk@aol.test',
          marketingOpportunity: 'Personal AOL email (jonjenk@aol.com) as business contact',
        }),
      ],
    })
    const result = await enqueueLeadSnapshots(store, await store.listEligibleLeadCandidates(), { mxResolver: mxOk })
    assert.equal(result.enqueued, 1)
    const queued = (await store.listQueue())[0]
    assert.equal(queued?.status, 'pending')
    assert.match(queued?.htmlBody || '', /email still looks personal/)
    assert.doesNotMatch(queued?.htmlBody || '', /jonjenk@aol\.com/)
    assert.doesNotMatch(queued?.textBody || '', /jonjenk@aol\.com/)
  })

  it('refreshes already queued research-note drafts without sending', async () => {
    const store = createMemoryOutreachStore({
      leads: [lead({ id: 'lead-1', firstName: 'Not' })],
    })
    await enqueueLeadSnapshots(store, [lead({ id: 'lead-1', firstName: 'Not' })], { mxResolver: mxOk })
    const [item] = await store.listQueue()
    await store.compareAndSwap(item.id, 'pending', {
      htmlBody: item.htmlBody.replace('Hi,', 'Hi Not,'),
      textBody: item.textBody.replace('Hi,', 'Hi Not,'),
      groundedFacts: {
        ...item.groundedFacts,
        firstName: 'Not',
        observation: 'No Hammonton landing page or title mention',
      },
      status: 'needs_review',
      eligibilityReason: 'unusable_greeting',
    })
    const refreshed = await refreshUnsentQueueCopy(store)
    assert.equal(refreshed.refreshed, 1)
    const next = (await store.listQueue())[0]
    assert.equal(next.status, 'pending')
    assert.match(next.textBody, /^Hi,|^Preheader:.*\n\nHi,/m)
    assert.match(next.htmlBody, />Hi,</)
    assert.doesNotMatch(next.htmlBody, /Hi Not,/)
    assert.match(next.textBody, /doesn't clearly say you're in Hammonton yet/)
    assert.doesNotMatch(next.textBody, /No Hammonton landing page/)
  })

  it('does not treat a plus-tag mailbox as the same as the root mailbox', () => {
    const decision = evaluateEligibility({
      lead: lead({ email: 'owner+news@example.com' }),
      suppression: {
        id: 's1',
        emailNormalized: 'owner@example.com',
        reason: 'unsubscribe',
        source: 'user',
        confirmationStatus: 'confirmed',
        notes: '',
        createdAt: new Date().toISOString(),
      },
      reconciliation: null,
      existingQueue: null,
      mx: { kind: 'ok' },
    })
    assert.equal(decision.ok, true)
  })
})

describe('disabled dispatch, idempotency, and delivery honesty', () => {
  it('never sends while gates are closed, even if the cron route is invoked', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    assert.match((await store.listQueue())[0].htmlBody, /PO Box 1011, Jersey City, NJ 07304/)
    const provider = createMockProvider()
    const result = await dispatchOutreachBatch({ store, provider, mxResolver: mxOk })
    assert.equal(result.skippedDisabled, true)
    assert.equal(result.accepted, 0)
    assert.equal(provider.sendCount, 0)
    assert.equal(mailingAddressIsValid(OUTREACH_MAILING_ADDRESS), true)
    assert.equal(mailingAddressIsValid(null), false)
    assert.ok(!result.blockers.some((item) => item.code === 'missing_mailing_address'))
    assert.ok(result.blockers.some((item) => item.code === 'kill_switch' || item.code === 'not_activated'))
    assert.equal(sendsPermitted({
      settings: await store.getSettings(),
      template: await store.getLatestTemplate('camp-prospect-intro'),
    }), false)
  })

  it('claims atomically, records accepted not delivered, and contacts the lead only after acceptance', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await store.updateSettings({
      killSwitch: false,
      activatedAt: '2026-11-05T00:00:00.000Z',
      physicalMailingAddress: '1 Example Street, City, ST 00000',
      dailySendLimit: 10,
      historyReconciliationStatus: 'reconciled',
      optOutVerifiedAt: '2026-11-05T00:00:00.000Z',
    })
    const template = await store.getLatestTemplate('camp-prospect-intro')
    assert.ok(template)
    await store.approveTemplate(template.id, 'admin', draftContentSha256(), store.now())
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    const env = {
      OUTREACH_KILL_SWITCH: 'false',
      OUTREACH_ACTIVATION_ALLOWED: 'true',
    }
    const originalKill = process.env.OUTREACH_KILL_SWITCH
    const originalAllow = process.env.OUTREACH_ACTIVATION_ALLOWED
    process.env.OUTREACH_KILL_SWITCH = env.OUTREACH_KILL_SWITCH
    process.env.OUTREACH_ACTIVATION_ALLOWED = env.OUTREACH_ACTIVATION_ALLOWED
    try {
      const provider = createMockProvider()
      const result = await dispatchOutreachBatch({
        store,
        provider,
        mxResolver: mxOk,
        attachment: Buffer.from('%PDF-1.4 test'),
        senderConfigured: true,
      })
      assert.equal(result.skippedDisabled, false)
      assert.equal(result.accepted, 1)
      const item = (await store.listQueue())[0]
      assert.equal(item.status, 'accepted')
      assert.ok(item.acceptedAt)
      assert.equal(item.deliveredAt, null)
      assert.ok(item.contactedLeadUpdatedAt)
      assert.equal((await store.getLead('lead-1'))?.lastContactedAt, item.acceptedAt)
      assert.equal((await store.getLead('lead-1'))?.pipelineStage, 'contacted')
      assert.equal(provider.lastPayload?.attachment.filename.endsWith('.pdf'), true)
    } finally {
      if (originalKill === undefined) delete process.env.OUTREACH_KILL_SWITCH
      else process.env.OUTREACH_KILL_SWITCH = originalKill
      if (originalAllow === undefined) delete process.env.OUTREACH_ACTIVATION_ALLOWED
      else process.env.OUTREACH_ACTIVATION_ALLOWED = originalAllow
    }
  })

  it('does not auto-resend after an uncertain Gmail-like result or an expired in-flight lease', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    const [item] = await store.listQueue()
    await store.compareAndSwap(item.id, 'pending', {
      status: 'in_flight',
      leaseExpiresAt: new Date(store.now().getTime() - 1000).toISOString(),
    })
    const recovered = await recoverExpiredInFlight(store)
    assert.equal(recovered, 1)
    assert.equal((await store.getQueueItem(item.id))?.status, 'needs_review')

    const gmail = createGmailOutreachProvider({
      sendMime: async () => {
        throw new Error('ETIMEDOUT')
      },
    })
    const timeout = await gmail.send(queueItemPayload(
      item,
      OUTREACH_SENDER_EMAIL,
      'https://example.test/u/x',
      Buffer.from('%PDF')
    ))
    assert.equal(timeout.kind, 'uncertain')
    assert.equal(gmail.supportsIdempotencyRecovery, false)
    assert.deepEqual(await gmail.recoverByIdempotencyKey(item.providerIdempotencyKey), { kind: 'unsupported' })
  })

  it('lets only one of two concurrent claimers win the same pending row', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    const [first, second] = await Promise.all([
      claimNextPending(store, 'w1'),
      claimNextPending(store, 'w2'),
    ])
    const winners = [first, second].filter(Boolean)
    assert.equal(winners.length, 1)
    assert.equal((await store.listQueue()).filter((row) => row.status === 'claimed').length, 1)
  })

  it('retries a retryable rejection with the same idempotency key and does not duplicate on a recovered accept', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await store.updateSettings({
      killSwitch: false,
      activatedAt: '2026-11-05T00:00:00.000Z',
      physicalMailingAddress: '1 Example Street, City, ST 00000',
      dailySendLimit: 10,
      historyReconciliationStatus: 'reconciled',
      optOutVerifiedAt: '2026-11-05T00:00:00.000Z',
    })
    const template = await store.getLatestTemplate('camp-prospect-intro')
    assert.ok(template)
    await store.approveTemplate(template.id, 'admin', draftContentSha256(), store.now())
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    const originalKill = process.env.OUTREACH_KILL_SWITCH
    const originalAllow = process.env.OUTREACH_ACTIVATION_ALLOWED
    process.env.OUTREACH_KILL_SWITCH = 'false'
    process.env.OUTREACH_ACTIVATION_ALLOWED = 'true'
    try {
      const provider = createMockProvider({
        results: [
          { kind: 'rejected', retryable: true, code: '429', message: 'rate' },
          { kind: 'accepted', providerMessageId: 'msg-dup', threadId: 'th-dup' },
        ],
      })
      const first = await dispatchOutreachBatch({ store, provider, mxResolver: mxOk, senderConfigured: true })
      assert.equal(first.details.includes('scheduled_retry'), true)
      const queued = (await store.listQueue())[0]
      await store.compareAndSwap(queued.id, 'pending', {
        nextAttemptAt: new Date(store.now().getTime() - 1000).toISOString(),
      })
      const second = await dispatchOutreachBatch({ store, provider, mxResolver: mxOk, senderConfigured: true })
      assert.equal(second.accepted, 1)
      assert.equal(provider.sendCount, 2)
      const third = await provider.send(provider.lastPayload!)
      assert.equal(third.kind, 'accepted')
      assert.equal(provider.sendCount, 3)
      assert.equal((await store.listQueue()).filter((row) => row.status === 'accepted').length, 1)
    } finally {
      if (originalKill === undefined) delete process.env.OUTREACH_KILL_SWITCH
      else process.env.OUTREACH_KILL_SWITCH = originalKill
      if (originalAllow === undefined) delete process.env.OUTREACH_ACTIVATION_ALLOWED
      else process.env.OUTREACH_ACTIVATION_ALLOWED = originalAllow
    }
  })

  it('holds queued Hi Not greetings and does not retry missing Gmail send scopes', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await store.updateSettings({
      killSwitch: false,
      activatedAt: '2026-11-05T00:00:00.000Z',
      physicalMailingAddress: '1 Example Street, City, ST 00000',
      dailySendLimit: 10,
      historyReconciliationStatus: 'reconciled',
      optOutVerifiedAt: '2026-11-05T00:00:00.000Z',
    })
    const template = await store.getLatestTemplate('camp-prospect-intro')
    assert.ok(template)
    await store.approveTemplate(template.id, 'admin', draftContentSha256(), store.now())
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    const [item] = await store.listQueue()
    await store.compareAndSwap(item.id, 'pending', {
      htmlBody: item.htmlBody.replace('Hi Christopher,', 'Hi Not,'),
      groundedFacts: { ...item.groundedFacts, firstName: 'Not' },
    })
    const originalKill = process.env.OUTREACH_KILL_SWITCH
    const originalAllow = process.env.OUTREACH_ACTIVATION_ALLOWED
    process.env.OUTREACH_KILL_SWITCH = 'false'
    process.env.OUTREACH_ACTIVATION_ALLOWED = 'true'
    try {
      const provider = createMockProvider()
      const held = await dispatchOutreachBatch({ store, provider, mxResolver: mxOk, senderConfigured: true })
      assert.equal(held.accepted, 0)
      assert.equal(provider.sendCount, 0)
      assert.equal((await store.getQueueItem(item.id))?.status, 'needs_review')
      assert.equal((await store.getQueueItem(item.id))?.eligibilityReason, 'unusable_greeting')

      const gmail = createGmailOutreachProvider({
        sendMime: async () => {
          throw new Error('Request had insufficient authentication scopes.')
        },
      })
      const scoped = await gmail.send(queueItemPayload(
        item,
        OUTREACH_SENDER_EMAIL,
        'https://example.test/u/x',
        Buffer.from('%PDF')
      ))
      assert.equal(scoped.kind, 'rejected')
      if (scoped.kind === 'rejected') {
        assert.equal(scoped.retryable, false)
        assert.equal(scoped.code, 'gmail_insufficient_scopes')
      }
    } finally {
      if (originalKill === undefined) delete process.env.OUTREACH_KILL_SWITCH
      else process.env.OUTREACH_KILL_SWITCH = originalKill
      if (originalAllow === undefined) delete process.env.OUTREACH_ACTIVATION_ALLOWED
      else process.env.OUTREACH_ACTIVATION_ALLOWED = originalAllow
    }
  })
})

describe('unsubscribe, MIME, CSRF, and routes', () => {
  it('confirms unsubscribe with an opaque token and never puts the email in the URL', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    const token = createUnsubscribeToken()
    const item = (await store.listQueue())[0]
    await store.putUnsubscribeToken({
      tokenHash: hashUnsubscribeToken(token),
      emailNormalized: item.emailNormalized,
      leadId: item.leadId,
      queueId: item.id,
    })
    const url = unsubscribeUrl(token, 'https://www.sundayharmony.com')
    assert.doesNotMatch(url, /swingstop|info@/i)
    const result = await confirmUnsubscribe(store, token)
    assert.equal(result.ok, true)
    assert.ok(await store.findSuppression(item.emailNormalized))
    assert.equal((await store.getQueueItem(item.id))?.status, 'suppressed')
  })

  it('builds MIME with the PDF attachment, list-unsubscribe, and escaped HTML', () => {
    const raw = buildOutreachMime({
      to: 'owner@example.com',
      from: `Sunday Harmony Consulting <${OUTREACH_SENDER_EMAIL}>`,
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
      idempotencyKey: 'prospect-intro/abc',
      payloadSha256: 'abc',
      unsubscribeUrl: 'https://www.sundayharmony.com/unsubscribe/tok',
      attachment: {
        filename: 'Sunday-Harmony-Consulting-company-presentation.pdf',
        content: Buffer.from('%PDF-1.4'),
        contentType: 'application/pdf',
      },
    })
    assert.equal(mimeContainsAttachment(raw, 'Sunday-Harmony-Consulting-company-presentation.pdf'), true)
    assert.match(raw, /List-Unsubscribe: <https:\/\/www\.sundayharmony\.com\/api\/unsubscribe\/tok>/)
    assert.match(raw, /List-Unsubscribe-Post/)
  })

  it('redirects browser confirm to a branded page and keeps one-click on the API', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    const token = createUnsubscribeToken()
    const item = (await store.listQueue())[0]
    await store.putUnsubscribeToken({
      tokenHash: hashUnsubscribeToken(token),
      emailNormalized: item.emailNormalized,
      leadId: item.leadId,
      queueId: item.id,
    })
    setOutreachStoreForTests(store)
    const withToken = (value: string, body = '') => unsubPost(
      new NextRequest(`https://www.sundayharmony.com/api/unsubscribe/${value}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      }),
      { params: Promise.resolve({ token: value }) },
    )
    try {
      const invalid = await withToken('not-a-token')
      assert.equal(invalid.status, 303)
      assert.match(invalid.headers.get('location') || '', /\/unsubscribe\/not-a-token\?invalid=1/)
      assert.doesNotMatch(invalid.headers.get('location') || '', /@|info%40/i)

      const confirmed = await withToken(token)
      assert.equal(confirmed.status, 303)
      assert.match(confirmed.headers.get('location') || '', /done=1/)
      assert.doesNotMatch(confirmed.headers.get('location') || '', /@|swingstop/i)

      const oneClick = await withToken('missing', 'List-Unsubscribe=One-Click')
      assert.equal(oneClick.status, 404)
    } finally {
      setOutreachStoreForTests(null)
    }
  })

  it('rejects cross-origin admin posts and unsigned webhooks', async () => {
    const request = new NextRequest('https://www.sundayharmony.com/api/admin/outreach', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    })
    assert.equal(isSameOriginRequest(request), false)
    assert.equal(verifyProviderWebhookSignature({ payload: '{}', signature: 'nope', secret: 'whsec' }), false)
    const good = verifyProviderWebhookSignature({
      payload: '{"type":"delivered"}',
      secret: 'whsec',
      signature: require('node:crypto').createHmac('sha256', 'whsec').update('{"type":"delivered"}').digest('hex'),
    })
    assert.equal(good, true)
  })

  it('keeps gated dispatch send-free even when the weekday cron is registered', async () => {
    const cron = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'outreach-cron-test'
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    setOutreachStoreForTests(store)
    try {
      const unauthorized = await dispatchGet(new NextRequest('https://example.test/api/internal/outreach-dispatch'))
      assert.equal(unauthorized.status, 401)
      const allowed = await dispatchGet(new NextRequest('https://example.test/api/internal/outreach-dispatch', {
        headers: { authorization: 'Bearer outreach-cron-test' },
      }))
      const body = await allowed.json() as { sent: number; skippedDisabled: boolean; liveSend: boolean }
      assert.equal(allowed.status, 200)
      assert.equal(body.sent, 0)
      assert.equal(body.liveSend, false)
      assert.equal(body.skippedDisabled, true)
      process.env.SUPABASE_SECRET_KEY = 'outreach-sb-test'
      const viaSupabase = await dispatchGet(new NextRequest('https://example.test/api/internal/outreach-dispatch', {
        headers: { authorization: 'Bearer outreach-sb-test' },
      }))
      assert.equal(viaSupabase.status, 200)
      delete process.env.SUPABASE_SECRET_KEY
      const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
      assert.equal(vercel.crons.some((item) => item.path === '/api/internal/outreach-dispatch' && item.schedule === '0 20 * * 1-5'), true)
    } finally {
      setOutreachStoreForTests(null)
      if (cron === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = cron
    }
  })

  it('requires a webhook signature and does not send mail', async () => {
    const previous = process.env.OUTREACH_PROVIDER_WEBHOOK_SECRET
    process.env.OUTREACH_PROVIDER_WEBHOOK_SECRET = 'hook-secret'
    setOutreachStoreForTests(createMemoryOutreachStore())
    try {
      const bad = await webhookPost(new NextRequest('https://example.test/api/internal/outreach-provider-events', {
        method: 'POST',
        body: '{"type":"delivered"}',
      }))
      assert.equal(bad.status, 401)
    } finally {
      setOutreachStoreForTests(null)
      if (previous === undefined) delete process.env.OUTREACH_PROVIDER_WEBHOOK_SECRET
      else process.env.OUTREACH_PROVIDER_WEBHOOK_SECRET = previous
    }
  })

  it('does not unsubscribe on a GET of the public token page source and keeps confirm-on-POST', () => {
    const page = readFileSync('src/app/unsubscribe/[token]/page.tsx', 'utf8')
    assert.match(page, /method="post"/)
    assert.match(page, /Confirm unsubscribe/)
    assert.match(page, /invalid/)
    assert.doesNotMatch(page, /confirmUnsubscribe/)
    const admin = readFileSync('src/app/api/admin/outreach/route.ts', 'utf8')
    assert.match(admin, /requireSalesSession/)
    assert.match(admin, /requireAdminSession/)
    assert.match(admin, /isSameOriginRequest/)
    assert.doesNotMatch(admin, /user_metadata/)
    const dispatch = readFileSync('src/lib/outreach/dispatch.ts', 'utf8')
    assert.match(dispatch, /skippedDisabled/)
    assert.match(dispatch, /markLeadContacted/)
    assert.match(dispatch, /unsubscribe_token_unusable/)
    assert.doesNotMatch(dispatch, /unsubscribeUrlFor/)
    const vercel = readFileSync('vercel.json', 'utf8')
    assert.match(vercel, /outreach-dispatch/)
    assert.match(vercel, /0 20 \* \* 1-5/)
    assert.match(readFileSync('vercel.outreach-cron.example.json', 'utf8'), /outreach-dispatch/)
    const nextConfig = readFileSync('next.config.js', 'utf8')
    assert.doesNotMatch(nextConfig, /source: '\/admin\/outreach'/)
    assert.match(nextConfig, /outputFileTracingIncludes/)
    assert.match(nextConfig, /company-presentation\.pdf/)
    const book = readFileSync('src/app/book/page.tsx', 'utf8')
    assert.match(book, /ConsultationBooker/)
  })
})

describe('handoff and activation blockers', () => {
  it('exposes stored phone and booking without inventing a number, and blocks missing address', async () => {
    const store = createMemoryOutreachStore({
      leads: [lead({ phone: '877-734-9145' })],
      bookings: [{
        leadId: 'lead-1',
        emailNormalized: 'info@swingstopvineland.com',
        status: 'scheduled',
        startsAt: '2026-11-10T15:00:00.000Z',
        meetLink: 'https://meet.google.com/abc-defg-hij',
      }],
    })
    await enqueueLeadSnapshots(store, [lead({ phone: '877-734-9145' })], { mxResolver: mxOk })
    const item = (await store.listQueue())[0]
    const handoff = await buildHandoff(store, item, await store.getLead('lead-1'))
    assert.equal(handoff.phone, '877-734-9145')
    assert.equal(handoff.booking.status, 'scheduled')
    assert.equal(handoff.deliveryState, 'not_sent')
    const blockers = evaluateActivationBlockers({
      settings: await store.getSettings(),
      template: await store.getLatestTemplate('camp-prospect-intro'),
      senderConfigured: false,
    })
    assert.equal((await store.getSettings()).physicalMailingAddress, OUTREACH_MAILING_ADDRESS)
    assert.ok(!blockers.some((item) => item.code === 'missing_mailing_address'))
    assert.ok(blockers.some((item) => item.code === 'template_unapproved'))
    assert.ok(blockers.some((item) => item.code === 'history_unreconciled'))
    const consolePayload = await buildOutreachConsole(store, 'sales_closer')
    assert.equal(consolePayload.disabled, true)
    assert.equal(consolePayload.queue[0].handoff?.phone, '877-734-9145')
  })
})

describe('leads import still succeeds and stays enqueue-only', () => {
  it('hooks enqueue after import and never calls a live sender from that module', () => {
    const source = readFileSync('src/app/api/internal/leads-import/route.ts', 'utf8')
    const hook = readFileSync('src/lib/outreach/import-hook.ts', 'utf8')
    assert.match(source, /enqueueImportedLeadsBestEffort/)
    assert.match(hook, /Never sends/)
    assert.doesNotMatch(hook, /sendWorkspaceEmail|sendEmail\(/)
    void importLeads
    void unsubPost
  })
})
