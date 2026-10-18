import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  HOMEPAGE_CREDIT_AD_ID,
  HOMEPAGE_MID_AD_ID,
  SEARCH_DESCRIPTION_MAX,
  SEARCH_HEADLINE_MAX,
  adCtaHref,
  adsForChannel,
  adsForLayout,
  adsForOffer,
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
    assert.equal(hero.headline, 'Stop guessing.')
    assert.equal(hero.accentPhrase, 'Start growing with a clear strategy.')
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
    assert.match(heroPage, /Start growing with a clear strategy/)
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
    const hero = source('src/components/Hero.tsx')
    const services = source('src/components/Services.tsx')
    const packages = source('src/components/Packages.tsx')
    const sidebar = source('src/components/admin/AdminSidebar.tsx')
    const overview = source('src/app/admin/page.tsx')
    const redirects = source('next.config.js')

    assert.match(home, /CampaignAdBanner/)
    assert.match(home, /HOMEPAGE_MID_AD_ID/)
    assert.match(home, /<Hero/)
    assert.match(home, /<Services/)
    assert.doesNotMatch(home, /<Packages/)
    assert.match(hero, /from '@\/lib\/data'/)
    assert.match(services, /from '@\/lib\/data'/)
    assert.match(packages, /from '@\/lib\/data'/)
    assert.match(banner, /AuditCtaButton/)
    assert.match(banner, /adCtaHref/)
    assert.doesNotMatch(sidebar, /\/admin\/ads/)
    assert.doesNotMatch(sidebar, /\/admin\/revenue/)
    assert.doesNotMatch(overview, /\/admin\/ads/)
    assert.doesNotMatch(overview, /\/admin\/revenue/)
    assert.match(redirects, /source: '\/admin\/ads'/)
    assert.match(redirects, /source: '\/admin\/revenue'/)
    assert.throws(() => source('src/app/admin/ads/page.tsx'))
    assert.throws(() => source('src/app/admin/revenue/page.tsx'))
    assert.throws(() => source('src/components/admin/campaign-ads/AdPreviewCard.tsx'))
  })

  it('sends marketing ads to the contact page', () => {
    const marketing = adsForOffer('marketing')
    assert.ok(marketing.length > 0)
    for (const ad of marketing) {
      if (!ad.ctaHref) {
        assert.equal(adCtaHref(ad), '/contact', ad.id)
      }
    }

    const home = source('src/app/page.tsx')
    const nav = source('src/lib/navigation.ts')
    assert.doesNotMatch(home, /ContactForm/)
    assert.match(nav, /href: '\/contact'/)
  })

  it('adds free credit analysis ads that send people to intake', () => {
    const creditAds = adsForOffer('credit')
    assert.ok(creditAds.length >= 12)

    for (const ad of creditAds) {
      assert.equal(adCtaHref(ad), '/credit', ad.id)
      assert.match(`${ad.headline} ${ad.accentPhrase ?? ''} ${ad.body} ${ad.ctaLabel}`, /credit|analysis/i, ad.id)
      assert.doesNotMatch(ad.body, /guarantee|guaranteed|remove all/i, ad.id)
    }

    const homepageCredit = getCampaignAd(HOMEPAGE_CREDIT_AD_ID)
    assert.equal(homepageCredit.offer, 'credit')
    assert.match(homepageCredit.headline, /Stop guessing at your credit/)
    assert.match(homepageCredit.ctaLabel, /Free Credit Analysis/)

    const home = source('src/app/page.tsx')
    const paths = source('src/components/HarmonyPaths.tsx')
    const banner = source('src/components/CampaignAdBanner.tsx')
    assert.match(home, /HOMEPAGE_CREDIT_AD_ID/)
    assert.match(home, /HarmonyPaths/)
    assert.match(paths, /Build the business/)
    assert.match(paths, /href: '\/funding'/)
    assert.match(paths, /focus=credit/)
    assert.match(paths, /href: '\/credit/)
    assert.match(banner, /ad\.ctaLabel/)
    assert.match(banner, /adCtaHref/)
  })

  it('does not restore the removed Gemini marketing-graphics stack', () => {
    const sidebar = source('src/components/admin/AdminSidebar.tsx')
    assert.doesNotMatch(sidebar, /marketing-graphics/)
    assert.doesNotMatch(source('src/lib/campaign-ads.ts'), /gemini/i)
  })
})
