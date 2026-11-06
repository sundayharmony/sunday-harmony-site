import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { parseCaseStudyFields } from '../case-study-fields'

describe('case study fields', () => {
  it('requires a company name and keeps a short public note', () => {
    const parsed = parseCaseStudyFields({
      companyName: '  Harbor Goods  ',
      blurb: 'We rebuilt their homepage.',
      published: true,
    })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.value.companyName, 'Harbor Goods')
    assert.equal(parsed.value.blurb, 'We rebuilt their homepage.')
    assert.equal(parsed.value.published, true)
  })

  it('rejects a blank company and defaults published on', () => {
    assert.equal(parseCaseStudyFields({ companyName: ' ', blurb: 'Hello' }).ok, false)
    const parsed = parseCaseStudyFields({ companyName: 'Harbor Goods' })
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.value.blurb, '')
    assert.equal(parsed.value.published, true)
  })

  it('keeps admin create/update on the case-study APIs', () => {
    const route = readFileSync('src/app/api/admin/case-studies/route.ts', 'utf8')
    const logo = readFileSync('src/app/api/admin/case-studies/logo/route.ts', 'utf8')
    const page = readFileSync('src/app/admin/case-study/page.tsx', 'utf8')
    const about = readFileSync('src/app/about/page.tsx', 'utf8')
    assert.match(route, /requireAdminSession/)
    assert.match(route, /createCaseStudy/)
    assert.match(route, /updateCaseStudy/)
    assert.match(logo, /saveCaseStudyLogo/)
    assert.match(page, /Add company/)
    assert.match(page, /What to say on the About page/)
    assert.doesNotMatch(page, /\/api\/admin\/partners/)
    assert.match(about, /listPublicCaseStudies/)
  })
})
