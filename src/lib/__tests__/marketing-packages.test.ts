import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { packagePriceDisplay, packages, services } from '../data'
import { detailedPackages } from '../toolkit-data'
import { formatTierListPrice, TIER_LABELS } from '../stripe-catalog'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('marketing packages', () => {
  it('publishes three branding-focused consulting pillars', () => {
    assert.equal(services.length, 3)
    assert.deepEqual(
      services.map((s) => s.title),
      ['Brand & Story', 'Outreach & Presence', 'Strategy & Rhythm']
    )
    const joined = services.map((s) => s.description).join(' ')
    assert.doesNotMatch(joined, /Local SEO|Meta Ads|Email Marketing/i)
  })

  it('publishes four packages: Business Essentials, Business Launch, Marketing Partner, Custom Solutions', () => {
    assert.deepEqual(
      packages.map((pkg) => pkg.tier),
      ['Business Essentials', 'Business Launch', 'Marketing Partner', 'Custom Solutions']
    )
    assert.equal(packages.find((pkg) => pkg.tier === 'Business Essentials')?.priceLabel, 'From $599')
    assert.equal(packages.find((pkg) => pkg.tier === 'Business Launch')?.priceLabel, 'From $1,799')
    assert.equal(packages.find((pkg) => pkg.tier === 'Marketing Partner')?.price, 799)

    const custom = packages.find((pkg) => pkg.tier === 'Custom Solutions')
    assert.equal(custom?.price, undefined)
    assert.equal(packagePriceDisplay(custom!), 'Custom quote')
    assert.equal(custom?.ctaLabel, 'Book a consultation')
  })

  it('keeps homepage and admin copy simple and included-only', () => {
    for (const pkg of packages) {
      assert.ok(pkg.features.every((feat) => feat.included), pkg.tier)
      assert.ok(pkg.features.length >= 4, pkg.tier)
    }

    const home = source('src/components/Packages.tsx')
    assert.match(home, /lg:grid-cols-4/)
    assert.match(home, /href="\/book"/)
    assert.match(home, /ctaLabel/)
    assert.doesNotMatch(home, /\/contact/)
    assert.doesNotMatch(home, /Social Essentials/)
    assert.match(home, /Four ways to work together/)
  })

  it('moves pricing off the homepage onto /services', () => {
    assert.doesNotMatch(source('src/app/page.tsx'), /<Packages/)
    const servicesPage = source('src/app/services/page.tsx')
    assert.match(servicesPage, /<Packages/)
    const nav = source('src/lib/navigation.ts')
    assert.match(nav, /label: 'Market', href: '\/services'/)
    assert.match(nav, /label: 'Fund', href: '\/build-fund'/)
    assert.ok(nav.indexOf("label: 'Market'") < nav.indexOf("label: 'Fund'"))
    assert.ok(nav.indexOf("label: 'Fund'") < nav.indexOf("label: 'Contact'"))
    assert.doesNotMatch(nav, /Build & Fund/)
    const fundPage = source('src/app/build-fund/page.tsx')
    assert.match(fundPage, />\s*Fund\s*</)
    assert.doesNotMatch(fundPage, /Build & Fund/)
    assert.ok(nav.indexOf("label: 'Contact'") < nav.indexOf("label: 'About'"))
    assert.doesNotMatch(nav, /Repair Credit/)
  })

  it('keeps Social Essentials as a billing label for existing clients', () => {
    assert.equal(TIER_LABELS.social_essentials, 'Social Essentials')
    assert.equal(formatTierListPrice('spark'), '$599')
    assert.equal(formatTierListPrice('scale'), 'Custom')
    assert.match(source('src/app/dashboard/package/page.tsx'), /social_essentials/)
  })

  it('syncs admin toolkit to the same four plans', () => {
    assert.deepEqual(
      detailedPackages.map((pkg) => pkg.tier),
      ['Business Essentials', 'Business Launch', 'Marketing Partner', 'Custom Solutions']
    )
    assert.equal(detailedPackages[0]?.priceLabel, 'From $599')
    assert.equal(detailedPackages[1]?.priceLabel, 'From $1,799')
    assert.equal(detailedPackages[2]?.price, 799)
    assert.equal(detailedPackages[3]?.priceLabel, 'Custom')
  })
})
