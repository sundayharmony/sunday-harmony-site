import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import {
  buildPartnerReferralUrl,
  buildQrServerImageUrl,
  isAllowedReferralQrPayload,
  referralCodeFromQrPayload,
  referralQrDownloadFilename,
} from '../referral-qr'

const originalSite = process.env.NEXTAUTH_URL

before(() => {
  process.env.NEXTAUTH_URL = 'https://sundayharmony.com'
})

after(() => {
  if (originalSite === undefined) delete process.env.NEXTAUTH_URL
  else process.env.NEXTAUTH_URL = originalSite
})

describe('referral QR helpers', () => {
  it('builds qrserver image URLs with size', () => {
    const url = buildQrServerImageUrl('https://sundayharmony.com/credit?ref=ABC12345', 300)
    assert.match(url, /^https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/\?/)
    assert.match(url, /size=300x300/)
    assert.match(url, /data=https%3A%2F%2Fsundayharmony\.com%2Fcredit%3Fref%3DABC12345/)
  })

  it('builds partner referral URLs from codes', () => {
    assert.equal(buildPartnerReferralUrl('abc12345'), 'https://sundayharmony.com/credit?ref=ABC12345')
    assert.equal(buildPartnerReferralUrl(''), '')
  })

  it('allows only same-site credit intake links with ref', () => {
    const good = 'https://sundayharmony.com/credit?ref=ABC12345'
    assert.equal(isAllowedReferralQrPayload(good), true)
    assert.equal(referralCodeFromQrPayload(good), 'ABC12345')
    assert.equal(isAllowedReferralQrPayload('https://evil.example/credit?ref=ABC12345'), false)
    assert.equal(isAllowedReferralQrPayload('https://sundayharmony.com/admin'), false)
    assert.equal(isAllowedReferralQrPayload('https://sundayharmony.com/credit'), false)
  })

  it('sanitizes QR download filenames', () => {
    assert.equal(referralQrDownloadFilename('Acme Co.', 'XY12'), 'Acme-Co.-XY12-qr.png')
  })
})
