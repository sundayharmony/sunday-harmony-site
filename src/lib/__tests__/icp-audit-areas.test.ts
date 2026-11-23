import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAreas, overallScore, planFor, type DeepAuditData } from '../icp-audit-areas'
import { siteSignals } from '../icp-deep-audit'

const NOW = new Date('2026-11-23T12:00:00Z')

const google: DeepAuditData['google'] = {
  found: true, rating: 5, reviews: 219, photos: 4, hasHours: true, hasWebsite: false, hasPhone: true,
  phone: '(910) 555-0100', primaryType: 'auto_body_shop', location: { latitude: 34.2, longitude: -77.9 },
}

describe('full audit template', () => {
  it('reads site signals from HTML', () => {
    const html = `<title>Acme Auto | Wilmington Body Shop</title><meta name="viewport" content="w"><meta name="description" content="Collision repair in Wilmington since 1998."><link rel="icon" href="/f.ico"><meta property="og:image" content="x.jpg"><img class="site-logo" src="l.png"><a href="tel:9105550100">Call</a><a href="https://www.facebook.com/acmeauto">fb</a><a href="https://instagram.com/acme">ig</a><form></form><script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script><footer>© 2024 Acme</footer>`
    const s = siteSignals(html, { city: 'Wilmington, NC', googlePhone: '(910) 555-0100' })
    assert.equal(s.titleHasCity, true)
    assert.equal(s.tapToCall, true)
    assert.equal(s.phoneMatchesGoogle, true)
    assert.deepEqual(s.socials, ['facebook', 'instagram'])
    assert.equal(s.copyrightYear, 2024)
    assert.equal(s.analytics, true)
    assert.equal(s.logo && s.favicon && s.previewImage && s.metaDescription && s.form, true)
  })

  it('checks a no-website business in all 6 areas and maps the plan', () => {
    const empty = siteSignals('', { city: null, googlePhone: null })
    const d: DeepAuditData = {
      collectedAt: NOW.toISOString(), google, speed: null,
      site: { ...empty, state: 'none', url: null, https: false },
      competitors: [{ name: 'Rival', rating: 4.6, reviews: 400 }],
    }
    const areas = buildAreas(d, NOW)
    assert.deepEqual(areas.map((a) => a.key), ['google', 'website', 'branding', 'social', 'marketing', 'systems'])
    assert.equal(areas.find((a) => a.key === 'website')!.score, 0)
    assert.ok(areas.every((a) => a.checks.length > 0))
    const marketing = areas.find((a) => a.key === 'marketing')!
    assert.match(marketing.checks.find((c) => c.label.startsWith('Reviews'))!.note, /400 reviews to your 219/)
    const plan = planFor(areas)
    assert.equal(plan[0].name, 'Business Launch')
    assert.ok(plan.some((p) => p.name === 'Marketing Partner'))
    assert.ok(!plan.some((p) => p.name === 'Business Essentials'), 'no-site branding is part of Launch')
    assert.ok((overallScore(areas) ?? 100) < 50)
  })
})
