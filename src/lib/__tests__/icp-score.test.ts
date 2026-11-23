import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { htmlSignals, industryTier, pickEmail, scoreLead, type IcpInput } from '../icp-score'

const base: IcpInput = {
  industry: 'HVAC contractor',
  business: 'Acme Heating',
  rating: 4.8,
  reviewCount: 150,
  businessStatus: 'OPERATIONAL',
  placeFound: true,
  photoCount: 20,
  site: 'none',
  wrongLink: false,
  hasViewport: false,
  https: false,
  hasBookingOrForm: false,
  paysForSoftware: false,
  runsAds: false,
  email: 'owner@acme.com',
  phone: '555',
}

describe('ICP scoring', () => {
  it('tiers industries', () => {
    assert.equal(industryTier('HVAC contractor'), 25)
    assert.equal(industryTier('Pizzeria (brick oven)'), 5)
    assert.equal(industryTier('Cafe / seafood & catering'), 25)
    assert.equal(industryTier('Jewelry store'), 12)
  })

  it('puts a well-reviewed best-fit business with no site in the call band', () => {
    const r = scoreLead(base)
    assert.equal(r.factors.gap, 20)
    assert.equal(r.factors.size, 5)
    assert.equal(r.score, 25 + 20 + 20 + 0 + 5 + 10)
    assert.equal(r.band, 'call')
    assert.equal(r.offer, 'business_launch')
  })

  it('blocks unproven demand whatever the score', () => {
    const r = scoreLead({ ...base, reviewCount: 12 })
    assert.equal(r.band, 'no_contact')
    assert.match(r.reasons.join(), /unproven/)
  })

  it('disqualifies closed businesses, franchises and unreachable ones', () => {
    assert.equal(scoreLead({ ...base, businessStatus: 'CLOSED_PERMANENTLY' }).band, 'disqualified')
    assert.equal(scoreLead({ ...base, business: 'Meineke Car Care' }).band, 'disqualified')
    assert.equal(scoreLead({ ...base, email: null, phone: null }).band, 'disqualified')
  })

  it('scores a working but weak site', () => {
    const r = scoreLead({ ...base, site: 'ok', https: true, hasViewport: false, hasBookingOrForm: false, paysForSoftware: true })
    assert.equal(r.factors.gap, 15)
    assert.equal(r.factors.spend, 8)
    assert.equal(r.offer, 'business_essentials')
  })

  it('does not count a bot-blocked site as broken', () => {
    const r = scoreLead({ ...base, site: 'unreadable', https: true })
    assert.equal(r.factors.gap, 0)
    assert.equal(r.offer, 'business_essentials')
  })

  it('reads HTML signals and picks the site email', () => {
    const s = htmlSignals('<meta name="viewport" content="x"><script src="https://connect.facebook.net/x"></script><a href="https://www.vagaro.com/x">Book now</a>')
    assert.deepEqual(s, { hasViewport: true, hasBookingOrForm: true, paysForSoftware: true, runsAds: true })
    assert.equal(pickEmail('a@gmail.com logo@2x.png info@acme.com', 'www.acme.com'), 'info@acme.com')
    assert.equal(pickEmail('nothing here', 'acme.com'), null)
  })
})
