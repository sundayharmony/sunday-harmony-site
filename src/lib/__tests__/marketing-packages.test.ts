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

  it('publishes Spark, Growth, and custom Scale only', () => {
    assert.deepEqual(
      packages.map((pkg) => pkg.tier),
      ['Spark', 'Growth', 'Scale']
    )
    assert.equal(packages.find((pkg) => pkg.tier === 'Spark')?.price, 600)
    assert.equal(packages.find((pkg) => pkg.tier === 'Growth')?.price, 1400)

    const scale = packages.find((pkg) => pkg.tier === 'Scale')
    assert.equal(scale?.price, undefined)
    assert.equal(packagePriceDisplay(scale!), 'Custom')
    assert.equal(scale?.ctaLabel, 'Book a consultation')
  })

  it('keeps homepage and admin copy simple and included-only', () => {
    for (const pkg of packages) {
      assert.ok(pkg.features.every((feat) => feat.included), pkg.tier)
      assert.ok(pkg.features.length >= 4, pkg.tier)
    }

    const home = source('src/components/Packages.tsx')
    assert.match(home, /lg:grid-cols-3/)
    assert.match(home, /Book a consultation|ctaLabel/)
    assert.doesNotMatch(home, /Social Essentials/)
    assert.match(home, /Three ways to work together/)
  })

  it('moves pricing off the homepage onto /services', () => {
    assert.doesNotMatch(source('src/app/page.tsx'), /<Packages/)
    const servicesPage = source('src/app/services/page.tsx')
    assert.match(servicesPage, /<Packages/)
    const nav = source('src/lib/navigation.ts')
    assert.match(nav, /label: 'Services', href: '\/services'/)
    assert.ok(nav.indexOf("label: 'Services'") < nav.indexOf("label: 'Contact'"))
    assert.match(nav, /label: 'Build Credit', href: '\/credit'/)
    assert.doesNotMatch(nav, /Repair Credit/)
  })

  it('keeps Social Essentials as a billing label for existing clients', () => {
    assert.equal(TIER_LABELS.social_essentials, 'Social Essentials')
    assert.equal(formatTierListPrice('spark'), '$600')
    assert.equal(formatTierListPrice('scale'), 'Custom')
    assert.match(source('src/app/dashboard/package/page.tsx'), /social_essentials/)
  })

  it('syncs admin toolkit to the same three plans', () => {
    assert.deepEqual(
      detailedPackages.map((pkg) => pkg.tier),
      ['Spark', 'Growth', 'Scale']
    )
    assert.equal(detailedPackages[0]?.price, 600)
    assert.equal(detailedPackages[1]?.price, 1400)
    assert.equal(detailedPackages[2]?.priceLabel, 'Custom')
  })
})
