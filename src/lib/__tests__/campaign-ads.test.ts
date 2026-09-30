import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  HOMEPAGE_MID_AD_ID,
  SEARCH_DESCRIPTION_MAX,
  SEARCH_HEADLINE_MAX,
  adsForChannel,
  adsForLayout,
  adsForSource,
  campaignAds,
  formatCampaignAdText,
  getCampaignAd,
  searchAdWithinLimits,
} from '../campaign-ads'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('campaign ads library', () => {
  it('includes the live homepage hero and CTA ads', () => {
    const hero = getCampaignAd('hero-homepage')
    const cta = getCampaignAd('cta-homepage')

    assert.equal(hero.source, 'live')
    assert.equal(hero.headline, 'Stop guessing at marketing.')
    assert.equal(hero.accentPhrase, 'Start growing with clarity.')
    assert.match(hero.ctaLabel, /Free Audit/)

    assert.equal(cta.source, 'live')
    assert.equal(cta.headline, 'Ready to stop doing it all')
    assert.equal(cta.accentPhrase, 'yourself?')
  })

  it('keeps live ads aligned with homepage copy', () => {
    const heroPage = source('src/components/Hero.tsx')
    const ctaPage = source('src/components/CtaBanner.tsx')
    const liveHero = getCampaignAd('hero-homepage')
    const liveCta = getCampaignAd('cta-homepage')

    assert.match(heroPage, new RegExp(liveHero.headline.replace('.', '\\.')))
    assert.match(heroPage, /Start growing with clarity/)
    assert.match(ctaPage, /Ready to stop doing it all/)
    assert.match(ctaPage, /yourself\?/)
    assert.equal(liveCta.ctaLabel.includes('Free Audit'), true)
  })

  it('adds new variations beyond the two live homepage ads', () => {
    const live = adsForSource('live')
    const created = adsForSource('new')

    assert.equal(live.length, 2)
    assert.ok(created.length >= 20)
    assert.ok(campaignAds.length >= 24)
    assert.ok(adsForLayout('heroQuote').length >= 6)
    assert.ok(adsForLayout('ctaBlock').length >= 4)
    assert.ok(adsForLayout('search').length >= 4)
    assert.ok(adsForChannel('google').length >= 4)
  })

  it('uses unique ids and complete copy on every ad', () => {
    const ids = campaignAds.map((ad) => ad.id)
    assert.equal(new Set(ids).size, ids.length)

    for (const ad of campaignAds) {
      assert.ok(ad.headline.trim().length > 0, ad.id)
      assert.ok(ad.body.trim().length > 0, ad.id)
      assert.ok(ad.ctaLabel.trim().length > 0, ad.id)
      assert.ok(ad.channels.length > 0, ad.id)
      assert.equal(formatCampaignAdText(ad).includes(ad.headline), true, ad.id)
    }
  })

  it('keeps Google search ads inside headline and description limits', () => {
    const searchAds = adsForLayout('search')
    assert.ok(searchAds.length > 0)
    for (const ad of searchAds) {
      assert.equal(searchAdWithinLimits(ad), true, ad.id)
      assert.ok(ad.headline.length <= SEARCH_HEADLINE_MAX, ad.id)
      assert.ok(ad.body.length <= SEARCH_DESCRIPTION_MAX, ad.id)
    }
  })

  it('publishes a new mid-page homepage ad in the same CTA style', () => {
    const mid = getCampaignAd(HOMEPAGE_MID_AD_ID)
    assert.equal(mid.source, 'new')
    assert.match(mid.headline, /searching/i)

    const home = source('src/app/page.tsx')
    const banner = source('src/components/CampaignAdBanner.tsx')
    const adminPage = source('src/app/admin/ads/page.tsx')
    const sidebar = source('src/components/admin/AdminSidebar.tsx')

    assert.match(home, /CampaignAdBanner/)
    assert.match(home, /HOMEPAGE_MID_AD_ID/)
    assert.match(banner, /AuditCtaButton/)
    assert.match(adminPage, /Campaign Ads/)
    assert.match(sidebar, /\/admin\/ads/)
  })

  it('does not restore the removed Gemini marketing-graphics stack', () => {
    const sidebar = source('src/components/admin/AdminSidebar.tsx')
    assert.doesNotMatch(sidebar, /marketing-graphics/)
    assert.doesNotMatch(source('src/lib/campaign-ads.ts'), /gemini/i)
  })
})
