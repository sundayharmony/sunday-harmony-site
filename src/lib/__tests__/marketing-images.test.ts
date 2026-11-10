import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import {
  marketingImageCounts,
  marketingImages,
  marketingImagesFor,
  marketingImageSections,
} from '../marketing-images'

describe('marketing licensed images', () => {
  it('places every licensed folder image in the catalog', () => {
    assert.equal(marketingImages.length, 81)
    assert.equal(marketingImageCounts['business-essentials'], 22)
    assert.equal(marketingImageCounts['business-launch'], 20)
    assert.equal(marketingImageCounts['marketing-partner'], 15)
    assert.equal(marketingImageCounts['custom-solutions'], 18)
    assert.equal(marketingImageCounts['business-blueprint'], 2)
    assert.equal(marketingImageCounts['where-to-find-prospects'], 1)
    assert.equal(marketingImageCounts['what-to-build-next'], 3)
  })

  it('keeps alt text free of reference slugs and company names', () => {
    const banned = /behance|fiverr|dribbble|chatgpt|hubspot|brandhavan|south bend|whitney|corteva|goel/i
    for (const image of marketingImages) {
      assert.equal(banned.test(image.alt), false, image.alt)
      assert.equal(banned.test(image.src), false, image.src)
      assert.match(image.src, /\.webp$/)
      assert.ok(existsSync(`public${image.src}`), image.src)
      assert.ok(image.width <= 1280)
      assert.ok(image.height > 0)
    }
  })

  it('wires package and section surfaces to the galleries', () => {
    const packages = readFileSync('src/components/Packages.tsx', 'utf8')
    const services = readFileSync('src/app/services/page.tsx', 'utf8')
    const process = readFileSync('src/components/Process.tsx', 'utf8')
    const about = readFileSync('src/components/About.tsx', 'utf8')
    assert.match(packages, /featuredMarketingImage/)
    assert.match(services, /PackageLookSection/)
    assert.match(process, /business-blueprint/)
    assert.match(process, /what-to-build-next/)
    assert.match(about, /where-to-find-prospects/)
    assert.equal(marketingImageSections.length, 7)
    assert.equal(marketingImagesFor('business-essentials').length, 22)
  })
})
