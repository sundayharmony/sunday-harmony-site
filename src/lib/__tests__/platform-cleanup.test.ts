import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { CREDIT_REPAIR_AGREEMENT } from '../credit-repair-agreement'
import { parseIntakePayload, validateCreditAccountStart, withDraftBasics } from '../credit-funding-validation'
import { letterMailTaskCopy } from '../dispute-letters/mail-task'
import { mayDownloadSignedDocument } from '../service-documents'
import { brandColors } from '../brand-tokens'

describe('credit account start', () => {
  it('accepts basic identity and a password, and keeps bureau logins off this step', () => {
    const payload = parseIntakePayload({
      fullName: 'Ada Client',
      dateOfBirth: '1990-01-02',
      email: 'ada@example.com',
      phone: '6095550100',
      address: '1 Main',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    })
    assert.equal(validateCreditAccountStart(payload, 'Sunday1a'), null)
    assert.match(validateCreditAccountStart(payload, 'short') || '', /8 characters/)
    assert.match(validateCreditAccountStart(payload, '') || '', /8 characters/)
  })

  it('fills empty file fields from the draft', () => {
    const payload = parseIntakePayload({ email: '', fullName: '' })
    const merged = withDraftBasics(payload, {
      fullName: 'Ada Client',
      email: 'ada@example.com',
      address: '1 Main',
      city: 'Austin',
      state: 'tx',
      zipCode: '78701',
      dateOfBirth: '1990-01-02',
    })
    assert.equal(merged.fullName, 'Ada Client')
    assert.equal(merged.state, 'TX')
    assert.equal(merged.dateOfBirth, '1990-01-02')
  })
})

describe('signed agreement access', () => {
  const document = { client_email: 'ada@example.com', created_by: 'staff-1' }

  it('lets the client and the staff member who created it download', () => {
    assert.equal(mayDownloadSignedDocument({ role: 'client', email: 'ada@example.com', document }), true)
    assert.equal(mayDownloadSignedDocument({ role: 'sales_closer', userId: 'staff-1', document }), true)
    assert.equal(mayDownloadSignedDocument({ role: 'admin', document }), true)
  })

  it('blocks other staff', () => {
    assert.equal(mayDownloadSignedDocument({ role: 'sales_closer', userId: 'staff-2', document }), false)
  })
})

describe('credit repair agreement', () => {
  it('makes no score promise and limits liability to the fee', () => {
    assert.match(CREDIT_REPAIR_AGREEMENT, /does not promise/i)
    assert.match(CREDIT_REPAIR_AGREEMENT, /go down/)
    assert.match(CREDIT_REPAIR_AGREEMENT, /limited to the fee/)
    assert.match(CREDIT_REPAIR_AGREEMENT, /3 business days/)
    assert.doesNotMatch(CREDIT_REPAIR_AGREEMENT, /guarantee/i)
  })
})

describe('letter mail task', () => {
  it('names the sender and each receiver', () => {
    const copy = letterMailTaskCopy({
      sessionId: 'sess-1',
      consumerName: 'Ada Client',
      receivers: ['Experian', 'TransUnion'],
      senderEmail: 'sales@sundayharmony.com',
    })
    assert.match(copy.title, /Ada Client/)
    assert.match(copy.description, /session:sess-1/)
    assert.match(copy.description, /Sunday Harmony \(sales@sundayharmony.com\)/)
    assert.match(copy.description, /Experian/)
    assert.match(copy.description, /TransUnion/)
  })
})

describe('brand tokens', () => {
  it('matches the stylesheet accent', () => {
    const css = readFileSync('src/styles/globals.css', 'utf8')
    assert.match(css, new RegExp(brandColors.accent))
    assert.match(css, new RegExp(brandColors.accentSoft))
    assert.match(readFileSync('tailwind.config.ts', 'utf8'), /brandColors/)
  })
})
