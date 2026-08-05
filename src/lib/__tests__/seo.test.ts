import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { absoluteUrl, getSiteUrl, organizationJsonLd, websiteJsonLd } from '../seo'

describe('seo helpers', () => {
  it('builds absolute URLs without double slashes', () => {
    const base = getSiteUrl()
    assert.equal(absoluteUrl('/'), base)
    assert.equal(absoluteUrl('/case-studies'), `${base}/case-studies`)
    assert.equal(absoluteUrl('credit-funding'), `${base}/credit-funding`)
  })

  it('emits Organization and WebSite JSON-LD with the public site URL', () => {
    const org = organizationJsonLd()
    const site = websiteJsonLd()
    assert.equal(org['@type'], 'Organization')
    assert.equal(org.url, getSiteUrl())
    assert.equal(site['@type'], 'WebSite')
    assert.equal(site.url, getSiteUrl())
  })
})
