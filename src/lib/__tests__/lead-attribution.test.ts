import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ATTRIBUTION_COOKIE,
  attributionFromParams,
  encodeAttribution,
  isPaidAttribution,
  readAttributionCookie,
  shouldSaveTouch,
} from '../lead-attribution'

describe('lead attribution', () => {
  it('keeps only ad parameters', () => {
    const attr = attributionFromParams(new URLSearchParams('utm_source=meta&utm_campaign=credit-q4&ref=abc&x=1'))
    assert.deepEqual(attr, { utm_source: 'meta', utm_campaign: 'credit-q4' })
    assert.equal(attributionFromParams(new URLSearchParams('ref=abc')), null)
  })

  it('counts click IDs and paid mediums as ads', () => {
    assert.equal(isPaidAttribution({ gclid: 'x' }), true)
    assert.equal(isPaidAttribution({ fbclid: 'x' }), true)
    assert.equal(isPaidAttribution({ utm_medium: 'cpc' }), true)
    assert.equal(isPaidAttribution({ utm_medium: 'paid_social' }), true)
    assert.equal(isPaidAttribution({ utm_medium: 'email' }), false)
    assert.equal(isPaidAttribution(null), false)
  })

  it('reads the saved first touch back from the cookie', () => {
    const value = encodeURIComponent('utm_source=google&utm_medium=cpc')
    const attr = readAttributionCookie(`sh_ref=abc; ${ATTRIBUTION_COOKIE}=${value}`)
    assert.deepEqual(attr, { utm_source: 'google', utm_medium: 'cpc' })
    assert.equal(readAttributionCookie('sh_ref=abc'), null)
  })

  it('round-trips values with reserved characters', () => {
    const attr = { utm_campaign: 'a&b=c%d', gclid: 'Cj0K-x_y' }
    assert.deepEqual(readAttributionCookie(`${ATTRIBUTION_COOKIE}=${encodeAttribution(attr)}`), attr)
  })

  it('keeps the first touch unless a paid click follows an unpaid one', () => {
    const email = { utm_source: 'newsletter', utm_medium: 'email' }
    const google = { gclid: 'abc' }
    assert.equal(shouldSaveTouch(null, email), true)
    assert.equal(shouldSaveTouch(email, google), true)
    assert.equal(shouldSaveTouch(google, email), false)
    assert.equal(shouldSaveTouch(google, { fbclid: 'z' }), false)
    assert.equal(shouldSaveTouch(email, null), false)
  })
})
