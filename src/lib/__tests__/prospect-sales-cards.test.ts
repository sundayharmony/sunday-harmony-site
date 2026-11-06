import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { prospectAgreementCard, prospectMeetingCardState } from '../prospect-sales-cards'

describe('prospect agreement card', () => {
  it('uses signed documents even when the CRM checkbox is empty', () => {
    const signed = prospectAgreementCard({
      agreementSignedAt: null,
      documents: [{
        document_type: 'agreement',
        status: 'signed',
        document_number: 'SA-2611-0042',
        sent_at: '2026-11-01T15:00:00.000Z',
        signed_at: '2026-11-02T16:00:00.000Z',
      }],
    })
    assert.equal(signed.status, 'signed')
    assert.equal(signed.documentNumber, 'SA-2611-0042')
    assert.equal(signed.signedAt, '2026-11-02T16:00:00.000Z')
  })

  it('treats sent and viewed agreements as awaiting signature', () => {
    const sent = prospectAgreementCard({
      agreementSignedAt: null,
      documents: [{
        document_type: 'agreement',
        status: 'viewed',
        document_number: 'SA-2611-0007',
        sent_at: '2026-11-03T12:00:00.000Z',
      }],
    })
    assert.equal(sent.status, 'sent')
    assert.equal(sent.documentNumber, 'SA-2611-0007')
  })

  it('lets a CRM signed timestamp win when no document row exists', () => {
    const card = prospectAgreementCard({
      agreementSignedAt: '2026-11-04T18:00:00.000Z',
      documents: [],
    })
    assert.equal(card.status, 'signed')
    assert.equal(card.signedAt, '2026-11-04T18:00:00.000Z')
  })

  it('does not treat a proposal document as an agreement', () => {
    const card = prospectAgreementCard({
      agreementSignedAt: null,
      documents: [{
        document_type: 'proposal',
        status: 'sent',
        document_number: 'PR-2611-0001',
        sent_at: '2026-11-03T12:00:00.000Z',
      }],
    })
    assert.equal(card.status, 'none')
  })

  it('only exposes https agreement links', () => {
    const unsafe = prospectAgreementCard({
      agreementSignedAt: null,
      proposalDocUrl: 'http://example.com/sign',
      documents: [{ document_type: 'agreement', status: 'sent', sent_at: '2026-11-03T12:00:00.000Z' }],
    })
    assert.equal(unsafe.href, null)
    const safe = prospectAgreementCard({
      agreementSignedAt: null,
      proposalDocUrl: 'https://docs.google.com/document/d/agreement',
      documents: [{ document_type: 'agreement', status: 'sent', sent_at: '2026-11-03T12:00:00.000Z' }],
    })
    assert.equal(safe.href, 'https://docs.google.com/document/d/agreement')
  })
})

describe('prospect meeting card state', () => {
  const now = Date.parse('2026-11-05T18:00:00.000Z')

  it('is upcoming for a stored meeting that is still joinable', () => {
    const card = prospectMeetingCardState({
      now,
      storedMeetings: [{
        id: 'm1',
        scheduled_at: '2026-11-05T17:50:00.000Z',
        duration_minutes: 30,
        status: 'scheduled',
      }],
    })
    assert.equal(card.state, 'upcoming')
    assert.equal(card.joinable, true)
  })

  it('is upcoming for a future follow-up even without a stored row', () => {
    const card = prospectMeetingCardState({
      now,
      followUpAt: '2026-11-06T15:00:00.000Z',
      storedMeetings: [],
    })
    assert.equal(card.state, 'upcoming')
  })

  it('is past after the join cutoff and does not stay joinable', () => {
    const card = prospectMeetingCardState({
      now,
      storedMeetings: [{
        id: 'm1',
        scheduled_at: '2026-11-05T17:00:00.000Z',
        duration_minutes: 30,
        status: 'scheduled',
      }],
    })
    assert.equal(card.state, 'past')
    assert.equal(card.joinable, false)
  })

  it('is none when there is no stored meeting or follow-up', () => {
    const card = prospectMeetingCardState({
      now,
      storedMeetings: [],
      followUpAt: null,
      stage: 'contacted',
    })
    assert.equal(card.state, 'none')
  })

  it('keeps a meeting_scheduled stage upcoming while the Meet link is missing', () => {
    const card = prospectMeetingCardState({
      now,
      storedMeetings: [],
      followUpAt: null,
      stage: 'meeting_scheduled',
    })
    assert.equal(card.state, 'upcoming')
    assert.equal(card.joinable, false)
  })
})

describe('prospect file GET payload wiring', () => {
  it('returns agreementStatus and meeting history from the pipeline file route', () => {
    const route = readFileSync('src/app/api/admin/pipeline/[id]/route.ts', 'utf8')
    assert.match(route, /prospectFileSalesPayload/)
    assert.match(route, /agreementStatus: sales\.agreement\.status/)
    assert.match(route, /meetingHistory: sales\.meetingHistory/)
    assert.match(route, /meetingCardState: sales\.meetingCardState/)
    const lib = readFileSync('src/lib/marketing-crm.ts', 'utf8')
    assert.match(lib, /getServiceDocumentsForClient/)
    assert.match(lib, /includeEnded: true/)
  })
})
