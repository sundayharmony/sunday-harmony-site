import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  CREDIT_REPAIR_STEPS,
  FUNDING_STEPS,
  TALKING_POINTS,
  TOOLKIT_CONTENT_SOURCES,
  TOOLKIT_DEFINITIONS,
  TOOLKIT_NEXT_STEP,
  TOOLKIT_SECTIONS,
  collectToolkitPlainText,
} from '../partner-toolkit'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('partner toolkit content', () => {
  const text = collectToolkitPlainText()

  it('explains the three core ideas in plain language', () => {
    const ids = TOOLKIT_DEFINITIONS.map((item) => item.id)
    assert.deepEqual(ids, ['personal-credit', 'business-credit', 'personal-guarantee'])
    assert.match(text, /one person’s borrowing history/i)
    assert.match(text, /company’s borrowing history/i)
    assert.match(text, /repay personally if the business cannot/i)
  })

  it('follows the public credit and funding workflows', () => {
    assert.deepEqual(
      CREDIT_REPAIR_STEPS.map((step) => step.title),
      ['Secure intake', 'Review the reports', 'Take action', 'Track progress']
    )
    assert.deepEqual(
      FUNDING_STEPS.map((step) => step.title),
      ['Share the business', 'Review the file', 'Close the gaps', 'Choose the next step']
    )
    assert.match(text, /inaccurate or unverifiable/)
    assert.match(text, /cannot simply be removed/)
    assert.match(text, /Lenders decide/)
    assert.match(text, /does not ask for a Social Security number/)
  })

  it('keeps benefits qualified and omits invented pay or files', () => {
    assert.match(text, /does not guarantee funding/)
    assert.match(text, /does not list partner pay/)
    assert.doesNotMatch(text, /commission/i)
    assert.doesNotMatch(text, /sales-kit/i)
    assert.doesNotMatch(text, /\/admin\//)
    assert.doesNotMatch(text, /\.pdf/i)
    assert.doesNotMatch(text, /\$\d/)
    assert.doesNotMatch(text, /guaranteed approval/i)
    assert.doesNotMatch(text, /will delete/i)
    const guaranteeSnippets = [...text.matchAll(/guarantee\w*/gi)].map((match) => {
      const index = match.index ?? 0
      return text.slice(Math.max(0, index - 48), index + match[0].length + 28)
    })
    assert.ok(guaranteeSnippets.length > 0)
    for (const snippet of guaranteeSnippets) {
      assert.match(
        snippet,
        /personal guarantee|does not guarantee|not a personal guarantee|not guarantee/i
      )
    }
  })

  it('points partners at sharing their QR code or referral link', () => {
    assert.equal(TOOLKIT_NEXT_STEP.title, 'Share your QR code or referral link.')
    assert.match(TOOLKIT_NEXT_STEP.lead, /choose Build or Fund/i)
    assert.equal(
      TALKING_POINTS.some((point) => /share your QR code or referral link/i.test(point.text)),
      true
    )
    assert.doesNotMatch(collectToolkitPlainText(), /\/build-fund/)
    assert.match(source('src/components/partner/PartnerToolkit.tsx'), /PartnerToolkitNextStep/)
    assert.match(source('src/components/partner/PartnerToolkitNextStep.tsx'), /ReferralLinkQrPanel/)
    assert.equal(
      TOOLKIT_SECTIONS.some((section) => section.id === 'next-step'),
      true
    )
  })

  it('cites existing files instead of inventing business facts', () => {
    for (const path of TOOLKIT_CONTENT_SOURCES) {
      assert.equal(existsSync(path), true, path)
    }
  })
})

describe('partner toolkit surface', () => {
  it('lives on the partner dashboard with role guards, not the staff sales kit', () => {
    const middleware = source('src/middleware.ts')
    assert.match(middleware, /path === '\/partner' \|\| path\.startsWith\('\/partner\/'\)/)
    assert.match(middleware, /role !== 'partner'/)
    assert.match(source('src/app/partner/layout.tsx'), /PartnerShell/)
    assert.match(source('src/components/partner/PartnerShell.tsx'), /href="\/partner\/toolkit"/)
    assert.match(source('src/components/partner/PartnerShell.tsx'), /href="\/partner\/account"/)
    assert.match(source('src/components/partner/PartnerShell.tsx'), /Dashboard/)
    assert.match(source('src/components/partner/PartnerShell.tsx'), /Toolkit/)
    assert.match(source('src/components/partner/PartnerShell.tsx'), /Account/)
    assert.match(source('src/components/partner/PartnerShell.tsx'), /\/api\/partner\/notifications/)
    assert.match(source('src/app/partner/toolkit/page.tsx'), /PartnerToolkit/)
    assert.match(source('src/app/partner/toolkit/page.tsx'), /NO_INDEX/)
    assert.doesNotMatch(source('src/components/partner/PartnerToolkit.tsx'), /sales-kit|salesMaterials/)
    assert.doesNotMatch(source('src/app/partner/page.tsx'), /sales-kit/)
    assert.match(source('src/app/api/partner/route.ts'), /requirePartnerSession/)
  })
})
