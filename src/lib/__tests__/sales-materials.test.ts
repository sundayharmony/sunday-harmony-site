import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { describe, it } from 'node:test'
import path from 'node:path'
import {
  salesMaterials,
  outreachEmailTemplates,
  socialPostTemplates,
  getPackageOptionsForAgreement,
  MATERIAL_CATEGORY_LABELS,
} from '../sales-materials'
import { packages } from '../data'

describe('sales materials', () => {
  it('has PDF materials in public/sales-materials including closer training', () => {
    assert.equal(salesMaterials.length, 6)
    for (const material of salesMaterials) {
      const fullPath = path.join(process.cwd(), 'public', material.pdfPath.replace(/^\//, ''))
      assert.ok(existsSync(fullPath), `Missing PDF: ${material.pdfPath}`)
      assert.ok(MATERIAL_CATEGORY_LABELS[material.category], `Missing label for ${material.category}`)
    }
    const training = salesMaterials.find((material) => material.id === 'closer-training-sop')
    assert.ok(training)
    assert.equal(training.category, 'training')
    assert.equal(MATERIAL_CATEGORY_LABELS.training, 'Training')
    assert.deepEqual(training.forRoles, ['admin', 'sales'])
    assert.equal(training.pdfPath, '/sales-materials/closer-training-sop.pdf')
  })

  it('assigns materials to appropriate roles', () => {
    const salesOnly = salesMaterials.filter(m => 
      m.forRoles.includes('sales') && !m.forRoles.includes('marketing')
    )
    const marketingOnly = salesMaterials.filter(m =>
      m.forRoles.includes('marketing') && !m.forRoles.includes('sales')
    )
    
    assert.ok(salesOnly.length >= 3, 'Sales should have at least presentation, proposal, agreement')
    assert.ok(marketingOnly.length >= 1, 'Marketing should have social posts')
    
    const presentation = salesMaterials.find(m => m.id === 'company-presentation')
    assert.ok(presentation?.forRoles.includes('sales'))
    
    const socialPosts = salesMaterials.find(m => m.id === 'social-posts')
    assert.ok(socialPosts?.forRoles.includes('marketing'))
  })

  it('has six outreach email templates with required fields', () => {
    assert.ok(outreachEmailTemplates.length >= 6)
    
    for (const template of outreachEmailTemplates) {
      assert.ok(template.id, 'Each template needs an id')
      assert.ok(template.title, 'Each template needs a title')
      assert.ok(template.useWhen, 'Each template needs useWhen')
      assert.ok(template.whenToSend, 'Each template needs whenToSend')
      assert.ok(template.subjectOptions.length >= 2, 'Each template needs at least 2 subject options')
      assert.ok(template.body.length > 50, 'Each template needs a body')
      assert.ok(template.tip, 'Each template needs a tip')
    }
    
    const firstTemplate = outreachEmailTemplates.find(t => t.id === 'established-outdated')
    assert.ok(firstTemplate)
    assert.match(firstTemplate.body, /audit/i, 'First template should mention audit')
  })

  it('has ten social post templates covering multiple platforms', () => {
    assert.equal(socialPostTemplates.length, 10)
    
    const platforms = new Set(socialPostTemplates.map(p => p.platform))
    assert.ok(platforms.has('Instagram + Facebook'), 'Should have Instagram + Facebook posts')
    
    for (const post of socialPostTemplates) {
      assert.ok(post.id, 'Each post needs an id')
      assert.ok(post.title, 'Each post needs a title')
      assert.ok(post.caption, 'Each post needs a caption')
      assert.ok(post.hashtags.length > 0, 'Each post needs hashtags')
      assert.ok(post.format, 'Each post needs a format')
      assert.ok(post.designDirection, 'Each post needs design direction')
    }
  })

  it('package options match current pricing data', () => {
    const options = getPackageOptionsForAgreement()
    
    assert.equal(options.length, packages.length)
    
    const essentials = options.find(o => o.tier === 'Business Essentials')
    assert.ok(essentials)
    assert.match(essentials.startingPrice, /599/)
    assert.equal(essentials.priceType, 'one-time')
    
    const partner = options.find(o => o.tier === 'Marketing Partner')
    assert.ok(partner)
    assert.match(partner.startingPrice, /799/)
    assert.equal(partner.priceType, 'monthly')
    
    const custom = options.find(o => o.tier === 'Custom Solutions')
    assert.ok(custom)
    assert.equal(custom.priceType, 'custom')
  })
})

describe('service documents', () => {
  it('exports required functions and types', async () => {
    const mod = await import('../service-documents')
    
    assert.ok(typeof mod.createServiceDocument === 'function')
    assert.ok(typeof mod.getServiceDocument === 'function')
    assert.ok(typeof mod.getServiceDocumentByToken === 'function')
    assert.ok(typeof mod.getServiceDocumentsForClient === 'function')
    assert.ok(typeof mod.getServiceDocumentsForStaff === 'function')
    assert.ok(typeof mod.updateServiceDocument === 'function')
    assert.ok(typeof mod.sendDocumentToClient === 'function')
    assert.ok(typeof mod.signDocument === 'function')
    assert.ok(typeof mod.formatDocumentStatusBadge === 'function')
  })

  it('formatDocumentStatusBadge returns correct colors', async () => {
    const { formatDocumentStatusBadge } = await import('../service-documents')
    
    assert.match(formatDocumentStatusBadge('draft').color, /gray/)
    assert.match(formatDocumentStatusBadge('sent').color, /blue/)
    assert.match(formatDocumentStatusBadge('viewed').color, /yellow/)
    assert.match(formatDocumentStatusBadge('signed').color, /green/)
    assert.match(formatDocumentStatusBadge('expired').color, /red/)
  })
})
