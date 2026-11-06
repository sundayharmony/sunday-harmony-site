import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canRecordActivation, evaluateActivationBlockers, sendsPermitted } from '../outreach/activation'
import { attemptActivation, reconcileHistory, runOptOutVerification, saveOperatorSettings } from '../outreach/admin-actions'
import { buildOutreachConsole } from '../outreach/console'
import { dispatchOutreachBatch } from '../outreach/dispatch'
import { draftContentSha256 } from '../outreach/draft-shell'
import { enqueueLeadSnapshots } from '../outreach/enqueue'
import { createBoundGmailOutreachProvider, resolveOutreachProvider } from '../outreach/gmail-binding'
import { mimeContainsAttachment } from '../outreach/mime'
import { OPT_OUT_PROBE_EMAIL } from '../outreach/opt-out-verify'
import { createMockProvider, queueItemPayload } from '../outreach/provider'
import { OUTREACH_CRON_BATCH_LIMIT, OUTREACH_CRON_SCHEDULE, outreachCron } from '../outreach/scheduler'
import { createMemoryOutreachStore } from '../outreach/store'
import { htmlHasRealUnsubscribe } from '../outreach/tokens'
import { createUnsubscribeToken, hashUnsubscribeToken } from '../outreach/unsubscribe'
import type { LeadSnapshot } from '../outreach/types'
import { OUTREACH_CTA_URL, OUTREACH_SENDER_EMAIL } from '../outreach/constants'

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
const ADDRESS = '1 Example Street, City, ST 00000'
const PDF = Buffer.from('%PDF-1.4 test-bytes')

function googleEnv() {
  const previous = {
    id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    refresh: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    mailbox: process.env.GOOGLE_CALENDAR_ID,
    kill: process.env.OUTREACH_KILL_SWITCH,
    allow: process.env.OUTREACH_ACTIVATION_ALLOWED,
  }
  process.env.GOOGLE_CALENDAR_CLIENT_ID = 'test-client'
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'test-secret'
  process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'test-refresh'
  process.env.GOOGLE_CALENDAR_ID = OUTREACH_SENDER_EMAIL
  process.env.OUTREACH_KILL_SWITCH = 'false'
  process.env.OUTREACH_ACTIVATION_ALLOWED = 'true'
  return () => {
    restore('GOOGLE_CALENDAR_CLIENT_ID', previous.id)
    restore('GOOGLE_CALENDAR_CLIENT_SECRET', previous.secret)
    restore('GOOGLE_CALENDAR_REFRESH_TOKEN', previous.refresh)
    restore('GOOGLE_CALENDAR_ID', previous.mailbox)
    restore('OUTREACH_KILL_SWITCH', previous.kill)
    restore('OUTREACH_ACTIVATION_ALLOWED', previous.allow)
  }
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

async function openGates(store: ReturnType<typeof createMemoryOutreachStore>) {
  await store.updateSettings({
    killSwitch: false,
    activatedAt: '2026-11-05T00:00:00.000Z',
    physicalMailingAddress: ADDRESS,
    dailySendLimit: 10,
    historyReconciliationStatus: 'reconciled',
    optOutVerifiedAt: '2026-11-05T00:00:00.000Z',
  })
  const template = await store.getLatestTemplate('camp-prospect-intro')
  assert.ok(template)
  await store.approveTemplate(template.id, 'admin', draftContentSha256(), store.now())
}

describe('bound Gmail adapter', () => {
  it('sends HTML, text, PDF, booking CTA, and a real unsubscribe URL through the MIME binder', async () => {
    const captured: string[] = []
    const provider = createBoundGmailOutreachProvider({
      sendRawMime: async ({ rawMime }) => {
        captured.push(rawMime)
        return { id: 'gmail-msg-1', threadId: 'gmail-thread-1' }
      },
    })
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
    const item = (await store.listQueue())[0]
    const result = await provider.send(queueItemPayload(
      item,
      `Sunday Harmony Consulting <${OUTREACH_SENDER_EMAIL}>`,
      'https://www.sundayharmony.com/unsubscribe/opaque-token-value-123456',
      PDF
    ))
    assert.equal(result.kind, 'accepted')
    assert.equal(captured.length, 1)
    assert.match(captured[0], /text\/html/)
    assert.match(captured[0], /text\/plain/)
    assert.equal(mimeContainsAttachment(captured[0], item.attachmentFilename), true)
    assert.match(captured[0], /List-Unsubscribe/)
    assert.match(item.htmlBody, /sundayharmony\.com\/book/)
    assert.equal(item.htmlBody.includes(OUTREACH_CTA_URL), true)
    assert.equal(htmlHasRealUnsubscribe(item.htmlBody), true)
  })

  it('does not call the Gmail MIME sender when live send is not permitted', async () => {
    let called = 0
    const provider = resolveOutreachProvider({
      liveSendAllowed: false,
      sendRawMime: async () => {
        called += 1
        throw new Error('gmail should not run')
      },
    })
    const result = await provider.send(queueItemPayload(
      {
        ...(await (async () => {
          const store = createMemoryOutreachStore({ leads: [lead({})] })
          await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
          return (await store.listQueue())[0]
        })()),
      },
      OUTREACH_SENDER_EMAIL,
      'https://www.sundayharmony.com/unsubscribe/tok',
      PDF
    ))
    assert.equal(provider.name, 'disabled')
    assert.equal(result.kind, 'rejected')
    assert.equal(called, 0)
  })
})

describe('activation and settings gates', () => {
  it('ignores client verification booleans and does not record activation while gates fail', async () => {
    const store = createMemoryOutreachStore({ leads: [lead({})] })
    const result = await attemptActivation(store, {
      actorId: 'admin-1',
      clientBody: {
        schemaReady: true,
        senderConfigured: true,
        historyReconciled: true,
        optOutVerified: true,
        activated: true,
      },
    })
    assert.equal(result.status, 409)
    assert.equal(result.body.activated, false)
    assert.equal((await store.getSettings()).activatedAt, null)
  })

  it('records activation only after every server-side gate, then a hash/version change invalidates it', async () => {
    const restoreEnv = googleEnv()
    try {
      const store = createMemoryOutreachStore({ leads: [lead({})] })
      await store.updateSettings({
        killSwitch: false,
        physicalMailingAddress: ADDRESS,
        dailySendLimit: 5,
        historyReconciliationStatus: 'reconciled',
        optOutVerifiedAt: '2026-11-05T00:00:00.000Z',
      })
      const template = await store.getLatestTemplate('camp-prospect-intro')
      assert.ok(template)
      await store.approveTemplate(template.id, 'admin', draftContentSha256(), store.now())
      const recorded = await attemptActivation(store, { actorId: 'admin-1', clientBody: { schemaReady: false } })
      assert.equal(recorded.status, 200)
      assert.equal(recorded.body.activated, true)
      assert.ok((await store.getSettings()).activatedAt)

      const capOnly = await saveOperatorSettings(store, { dailySendLimit: 10, schemaReady: true, historyReconciled: true }, 'admin-1')
      assert.equal(capOnly.ok, true)
      const afterCap = await store.getLatestTemplate('camp-prospect-intro')
      assert.equal(afterCap?.approved, true)
      assert.equal((await store.getSettings()).dailySendLimit, 10)
      assert.equal((await store.getSettings()).settingsVersion, 1)

      const saved = await saveOperatorSettings(store, { physicalMailingAddress: 'PO Box 9999, Jersey City, NJ 07304', schemaReady: true, historyReconciled: true }, 'admin-1')
      assert.equal(saved.ok, true)
      const after = await store.getLatestTemplate('camp-prospect-intro')
      assert.equal(after?.approved, false)
      const blockers = evaluateActivationBlockers({
        settings: await store.getSettings(),
        template: after,
        schemaReady: true,
        senderConfigured: true,
        unsubscribeRoutePresent: true,
        attachmentPresent: true,
      })
      assert.ok(blockers.some((item) => item.code === 'template_unapproved'))
      assert.equal(sendsPermitted({
        settings: await store.getSettings(),
        template: after,
        schemaReady: true,
        senderConfigured: true,
        unsubscribeRoutePresent: true,
        attachmentPresent: true,
      }), false)
    } finally {
      restoreEnv()
    }
  })

  it('rejects a hash mismatch and a client-only history reconcile', async () => {
    const settings = (await createMemoryOutreachStore().getSettings())
    const blockers = evaluateActivationBlockers({
      settings: {
        ...settings,
        killSwitch: false,
        activatedAt: '2026-11-05T00:00:00.000Z',
        physicalMailingAddress: ADDRESS,
        dailySendLimit: 1,
        historyReconciliationStatus: 'reconciled',
        optOutVerifiedAt: '2026-11-05T00:00:00.000Z',
      },
      template: {
        id: 'tpl',
        campaignId: 'camp-prospect-intro',
        version: 1,
        subjectTemplate: 'x',
        preheaderTemplate: 'y',
        contentSha256: 'deadbeef',
        approved: true,
        approvedAt: '2026-11-05T00:00:00.000Z',
        approvedBy: 'admin',
        approvedSettingsVersion: 1,
      },
      schemaReady: true,
      senderConfigured: true,
      unsubscribeRoutePresent: true,
      attachmentPresent: true,
    })
    assert.ok(blockers.some((item) => item.code === 'template_hash_mismatch'))
    const store = createMemoryOutreachStore()
    const fake = await reconcileHistory(store, { historyReconciled: true }, 'admin-1')
    assert.equal(fake.ok, false)
    assert.equal((await store.getSettings()).historyReconciliationStatus, 'unverified_reports_loaded')
  })

  it('verifies opt-out by minting, persisting, confirming, and writing suppression', async () => {
    const store = createMemoryOutreachStore()
    const result = await runOptOutVerification(store, 'admin-1')
    assert.equal(result.ok, true)
    assert.ok(await store.findSuppression(OPT_OUT_PROBE_EMAIL))
    assert.ok((await store.getSettings()).optOutVerifiedAt)
  })
})

describe('dispatch safety: tokens, suppression, ambiguity, workers', () => {
  it('mints and persists an opaque unsubscribe token and never sends a preview-disabled URL', async () => {
    const restoreEnv = googleEnv()
    try {
      const store = createMemoryOutreachStore({ leads: [lead({})] })
      await openGates(store)
      await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
      const item = (await store.listQueue())[0]
      await store.compareAndSwap(item.id, item.status, {
        htmlBody: item.htmlBody.replace(/\/unsubscribe\/[A-Za-z0-9_-]+/, '/unsubscribe/preview-disabled'),
        textBody: 'preview /unsubscribe/preview-disabled',
      })
      const provider = createMockProvider()
      const result = await dispatchOutreachBatch({
        store,
        provider,
        mxResolver: mxOk,
        attachment: PDF,
        senderConfigured: true,
      })
      assert.equal(result.accepted, 1)
      assert.ok(provider.lastPayload)
      assert.doesNotMatch(provider.lastPayload.unsubscribeUrl, /preview-disabled/)
      assert.match(provider.lastPayload.unsubscribeUrl, /\/unsubscribe\/[A-Za-z0-9_-]{16,}/)
      assert.doesNotMatch(provider.lastPayload.unsubscribeUrl, /swingstop|info@/i)
      assert.equal(htmlHasRealUnsubscribe(provider.lastPayload.html), true)
      assert.ok(await store.findUnsubscribeTokenByQueueId(item.id))
    } finally {
      restoreEnv()
    }
  })

  it('rechecks suppression after claim and immediately before the provider call', async () => {
    const restoreEnv = googleEnv()
    try {
      const store = createMemoryOutreachStore({ leads: [lead({})] })
      await openGates(store)
      await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
      await store.addSuppression({
        emailNormalized: 'info@swingstopvineland.com',
        reason: 'unsubscribe',
        source: 'user',
        confirmationStatus: 'confirmed',
        notes: 'late opt-out',
      })
      const provider = createMockProvider()
      const result = await dispatchOutreachBatch({
        store,
        provider,
        mxResolver: mxOk,
        attachment: PDF,
        senderConfigured: true,
      })
      assert.equal(provider.sendCount, 0)
      assert.equal(result.accepted, 0)
      assert.ok(result.details.some((item) => item.startsWith('suppressed')))
      assert.equal((await store.getLead('lead-1'))?.lastContactedAt || null, null)
    } finally {
      restoreEnv()
    }
  })

  it('marks needs_review and does not contact the lead after an ambiguous Gmail crash', async () => {
    const restoreEnv = googleEnv()
    try {
      const store = createMemoryOutreachStore({ leads: [lead({})] })
      await openGates(store)
      await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
      const provider = createMockProvider({ crashAfterAccept: true })
      const result = await dispatchOutreachBatch({
        store,
        provider,
        mxResolver: mxOk,
        attachment: PDF,
        senderConfigured: true,
      })
      assert.equal(result.accepted, 0)
      assert.ok(result.reviewed.length)
      const item = (await store.listQueue())[0]
      assert.equal(item.status, 'needs_review')
      assert.equal(item.deliveredAt, null)
      assert.equal(item.contactedLeadUpdatedAt, null)
      assert.equal((await store.getLead('lead-1'))?.lastContactedAt || null, null)
    } finally {
      restoreEnv()
    }
  })

  it('lets only one of two concurrent dispatch workers accept the same row', async () => {
    const restoreEnv = googleEnv()
    try {
      const store = createMemoryOutreachStore({ leads: [lead({})] })
      await openGates(store)
      await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
      const providerA = createMockProvider({ results: [{ kind: 'accepted', providerMessageId: 'a', threadId: 'ta' }] })
      const providerB = createMockProvider({ results: [{ kind: 'accepted', providerMessageId: 'b', threadId: 'tb' }] })
      const [first, second] = await Promise.all([
        dispatchOutreachBatch({ store, provider: providerA, mxResolver: mxOk, attachment: PDF, senderConfigured: true, workerId: 'wa' }),
        dispatchOutreachBatch({ store, provider: providerB, mxResolver: mxOk, attachment: PDF, senderConfigured: true, workerId: 'wb' }),
      ])
      assert.equal(first.accepted + second.accepted, 1)
      assert.equal((providerA.sendCount + providerB.sendCount) <= 1, true)
      assert.equal((await store.listQueue()).filter((row) => row.status === 'accepted').length, 1)
    } finally {
      restoreEnv()
    }
  })

  it('does not treat accepted as delivered and registers the weekday send cron', async () => {
    const restoreEnv = googleEnv()
    try {
      const store = createMemoryOutreachStore({ leads: [lead({})] })
      await openGates(store)
      await enqueueLeadSnapshots(store, [lead({})], { mxResolver: mxOk })
      const provider = createMockProvider()
      const result = await dispatchOutreachBatch({
        store,
        provider,
        mxResolver: mxOk,
        attachment: PDF,
        senderConfigured: true,
      })
      assert.equal(result.accepted, 1)
      const item = (await store.listQueue())[0]
      assert.equal(item.status, 'accepted')
      assert.equal(item.deliveredAt, null)
      const cron = outreachCron()
      assert.equal(cron.enabled, true)
      assert.equal(cron.schedule, OUTREACH_CRON_SCHEDULE)
      assert.equal(OUTREACH_CRON_BATCH_LIMIT, 10)
      const consolePayload = await buildOutreachConsole(store, 'admin')
      assert.equal(consolePayload.liveSend, true)
      assert.equal(consolePayload.disabled, false)
      assert.equal(consolePayload.scheduler.enabled, true)
      assert.equal(createUnsubscribeToken() === createUnsubscribeToken(), false)
      assert.equal(hashUnsubscribeToken('abc').length, 64)
      assert.equal(canRecordActivation({
        settings: await store.getSettings(),
        template: await store.getLatestTemplate('camp-prospect-intro'),
        schemaReady: true,
        senderConfigured: true,
        unsubscribeRoutePresent: true,
        attachmentPresent: true,
      }), true)
    } finally {
      restoreEnv()
    }
  })

  it('defers uncertain MX and still fills the accepted batch from later queue items', async () => {
    const restoreEnv = googleEnv()
    try {
      const uncertain = lead({
        id: 'lead-mx-bad',
        email: 'info@uncertain-mx.test',
        business: 'Uncertain MX Cafe',
      })
      const okLead = lead({
        id: 'lead-mx-ok',
        email: 'hello@ok-mx.test',
        business: 'OK MX Studio',
      })
      const store = createMemoryOutreachStore({ leads: [uncertain, okLead] })
      await openGates(store)
      const mxResolver = async (domain: string) => {
        if (domain === 'uncertain-mx.test') {
          const error = new Error('timeout') as Error & { code: string }
          error.code = 'ETIMEOUT'
          throw error
        }
        return [{ priority: 10, exchange: 'mail.example.com' }]
      }
      await enqueueLeadSnapshots(store, [uncertain, okLead], { mxResolver })
      const queued = await store.listQueue()
      const badRow = queued.find((row) => row.leadId === 'lead-mx-bad')
      assert.ok(badRow)
      await store.compareAndSwap(badRow.id, 'pending', { nextAttemptAt: '2020-01-01T00:00:00.000Z' })
      const provider = createMockProvider()
      const result = await dispatchOutreachBatch({
        store,
        provider,
        mxResolver,
        attachment: PDF,
        senderConfigured: true,
        limit: 1,
      })
      assert.equal(result.accepted, 1)
      const queue = await store.listQueue()
      const deferred = queue.find((row) => row.leadId === 'lead-mx-bad')
      const sent = queue.find((row) => row.leadId === 'lead-mx-ok')
      assert.equal(deferred?.status, 'pending')
      assert.equal(deferred?.eligibilityReason, 'mx_uncertain')
      assert.ok(deferred && new Date(deferred.nextAttemptAt).getTime() > store.now().getTime())
      assert.equal(sent?.status, 'accepted')
    } finally {
      restoreEnv()
    }
  })
})
