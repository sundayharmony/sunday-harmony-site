import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { destinationAfterLogin } from '../login-redirect'
import { encryptField } from '../field-encryption'
import {
  formatPartnerDate,
  isReferralProfileAttributable,
  partnerCurrentScores,
  referralStatusForPartnerProfile,
  shouldSkipPartnerCommission,
  toPartnerReferralProgress,
} from '../partner-progress'
import { partnerSignupInviteEmailHtml } from '../partner-invite-email'
import { detectPartnerLogo, partnerLogoPublicUrl, validatePartnerLogo } from '../partner-logos'
import { parsePartnerSignup, partnerProfessionLabel } from '../partner-signup'
import { adminPartnerReferralContact } from '../partner-service'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('partner signup validation', () => {
  const valid = {
    fullName: 'Alex Rivera',
    email: 'alex@broker.example',
    password: 'Harbor1a',
    phone: '215-555-0100',
    companyName: 'Rivera Lending',
    serviceArea: 'Philadelphia',
    yearsInField: '8',
    profession: 'mortgage',
  }

  it('accepts a complete partner application', () => {
    const parsed = parsePartnerSignup(valid)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.value.email, 'alex@broker.example')
    assert.equal(parsed.value.yearsInField, 8)
    assert.equal(parsed.value.profession, 'mortgage')
  })

  it('rejects a weak password, unknown profession, and duplicate-looking empty company', () => {
    assert.equal(parsePartnerSignup({ ...valid, password: 'short' }).ok, false)
    assert.equal(parsePartnerSignup({ ...valid, profession: 'lawyer' }).ok, false)
    assert.equal(parsePartnerSignup({ ...valid, companyName: ' ' }).ok, false)
    assert.equal(parsePartnerSignup({ ...valid, yearsInField: '90' }).ok, false)
  })
})

describe('partner referral progress', () => {
  it('keeps inactive codes from attributing and skips partner commissions', () => {
    assert.equal(isReferralProfileAttributable('active'), true)
    assert.equal(isReferralProfileAttributable('disabled'), false)
    assert.equal(isReferralProfileAttributable(null), false)
    assert.equal(shouldSkipPartnerCommission({ client_id: null, partner_profile_id: 'p1' }), true)
    assert.equal(shouldSkipPartnerCommission({ client_id: 'c1', partner_profile_id: null }), false)

    const service = source('src/lib/referral-service.ts')
    assert.match(service, /isReferralProfileAttributable/)
    assert.match(service, /shouldSkipPartnerCommission/)
  })

  it('exposes a masked name, stage, dispute round, and current bureau scores', () => {
    const row = toPartnerReferralProgress({
      id: 'ref-1',
      date: '2026-10-01T00:00:00.000Z',
      fullName: 'Jane Doe',
      status: 'under_review',
      updatedAt: '2026-10-02T00:00:00.000Z',
      disputeRound: 2,
      currentScores: partnerCurrentScores({ tuc: 710, exp: 698, eqf: 705 }),
    })
    assert.equal(row.applicant, 'Jane D.')
    assert.equal(row.stage, 'Under review')
    assert.equal(row.disputeRound, 2)
    assert.equal(row.bucket, 'in_progress')
    assert.deepEqual(row.currentScores, { transunion: 710, experian: 698, equifax: 705 })
    const keys = Object.keys(row).sort()
    assert.deepEqual(keys, ['applicant', 'bucket', 'currentScores', 'date', 'disputeRound', 'id', 'stage', 'updatedAt'])
    assert.equal(JSON.stringify(row).includes('Doe'), false)
    assert.equal(JSON.stringify(row).includes('@'), false)
  })

  it('keeps current scores empty until a bureau score exists', () => {
    assert.equal(partnerCurrentScores(null), null)
    assert.equal(partnerCurrentScores({ tuc: null, exp: null, eqf: null }), null)
    assert.deepEqual(partnerCurrentScores({ exp: 640 }), {
      transunion: null,
      experian: 640,
      equifax: null,
    })
  })

  it('formats partner dates in America/New_York and labels professions safely', () => {
    assert.equal(formatPartnerDate(''), '—')
    assert.equal(formatPartnerDate('not-a-date'), '—')
    assert.equal(formatPartnerDate('2026-11-06T16:00:00.000Z'), 'Nov 6, 2026')
    assert.equal(formatPartnerDate('2026-11-06T03:00:00.000Z'), 'Nov 5, 2026')
    assert.equal(partnerProfessionLabel('mortgage'), 'Mortgage')
    assert.equal(partnerProfessionLabel('mystery_trade'), 'mystery trade')
    assert.equal(partnerProfessionLabel(''), '—')
    assert.equal(referralStatusForPartnerProfile('active'), 'active')
    assert.equal(referralStatusForPartnerProfile('pending'), 'disabled')
    assert.equal(referralStatusForPartnerProfile('disabled'), 'disabled')
  })

  it('decrypts referred-client phones before showing them to staff', () => {
    const contact = adminPartnerReferralContact({
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      phone: encryptField('215-555-0199'),
      application_id: 'CF-1',
      id: 'app-1',
    })
    assert.equal(contact.phone, '215-555-0199')
    assert.equal(contact.applicant, 'Jane Doe')
    assert.equal(
      adminPartnerReferralContact({ full_name: 'Ada', email: '', phone: '804-555-0100' }).phone,
      '804-555-0100'
    )
  })
})

describe('partner signup invite email', () => {
  it('uses the site gold, black button, and signup path', () => {
    const html = partnerSignupInviteEmailHtml({ firstName: 'Alex <script>' })
    assert.match(html, /#b8943f/)
    assert.match(html, /#0a0a0a/)
    assert.match(html, /#f4efe5/)
    assert.match(html, /\/partners\/signup/)
    assert.match(html, /Sign up as a partner/)
    assert.equal(html.includes('<script>'), false)
    assert.match(html, /Alex &lt;script&gt;/)
  })
})

describe('partner logos', () => {
  it('accepts png, jpeg, and webp and rejects other files', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')])
    assert.equal(detectPartnerLogo(png)?.ext, 'png')
    assert.equal(validatePartnerLogo(jpeg).ok, true)
    assert.equal(detectPartnerLogo(webp)?.mime, 'image/webp')
    assert.equal(validatePartnerLogo(Buffer.from('not a logo')).ok, false)
    assert.equal(validatePartnerLogo(Buffer.alloc(0)).ok, false)
    assert.equal(validatePartnerLogo(Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)])).ok, false)
  })

  it('builds a public storage url and hides the slideshow when there are no logos', () => {
    assert.equal(
      partnerLogoPublicUrl('partner-1/logo.png', 'https://example.supabase.co'),
      'https://example.supabase.co/storage/v1/object/public/partner-logos/partner-1/logo.png'
    )
    assert.equal(partnerLogoPublicUrl('../secret.png', 'https://example.supabase.co'), null)
    assert.equal(partnerLogoPublicUrl('', 'https://example.supabase.co'), null)
    const strip = source('src/components/PartnerLogos.tsx')
    assert.match(strip, /if \(logos\.length === 0\) return null/)
    assert.match(source('src/lib/partner-db.ts'), /eq\('status', 'active'\)/)
    assert.match(strip, /case-study-grid/)
    assert.match(strip, /logo\.blurb/)
  })
})

describe('partner surfaces', () => {
  it('sends partners to their dashboard and keeps signup off the client portal', () => {
    assert.equal(destinationAfterLogin({ role: 'partner' }), '/partner')
    const middleware = source('src/middleware.ts')
    assert.match(middleware, /role !== 'partner'/)
    assert.match(source('src/app/login/page.tsx'), /\/partners\/signup/)
    assert.match(source('src/app/credit/page.tsx'), /Sign up as a partner/)
    assert.match(source('src/app/funding/page.tsx'), /Sign up as a partner/)
    assert.match(source('src/app/api/partners/signup/route.ts'), /rateLimitDurable/)
    assert.match(source('src/app/api/admin/partners/route.ts'), /requireAdminSession/)
    assert.match(source('src/app/api/admin/partners/route.ts'), /getAdminPartnerDetail/)
    assert.match(source('src/app/api/admin/partners/route.ts'), /action === 'invite'/)
    assert.match(source('src/app/api/admin/partners/logo/route.ts'), /requireAdminSession/)
    assert.match(source('src/app/api/admin/partners/logo/route.ts'), /savePartnerLogo/)
    assert.match(source('src/app/admin/partners/page.tsx'), /redirect\('\/admin\/referrals\?tab=partners'\)/)
    assert.match(source('src/components/admin/AdminPartnerAccountsPanel.tsx'), /Email a signup link/)
    assert.match(source('src/components/admin/AdminPartnerAccountsPanel.tsx'), /choose Build or Fund/)
    assert.doesNotMatch(source('src/components/admin/AdminPartnerAccountsPanel.tsx'), /Upload logo/)
    assert.match(source('src/app/admin/case-study/page.tsx'), /Add company/)
    assert.match(source('src/app/admin/case-study/page.tsx'), /What to say on the About page/)
    assert.match(source('src/app/admin/case-study/page.tsx'), /\/api\/admin\/case-studies/)
    assert.match(source('src/app/about/page.tsx'), /PartnerLogos/)
    assert.match(source('src/app/about/page.tsx'), /listPublicCaseStudies/)
    assert.match(source('src/components/PartnerLogos.tsx'), /case-study-grid/)
    assert.match(source('src/components/PartnerLogos.tsx'), /Case studies/)
    assert.match(source('supabase-migration-045-partner-logos.sql'), /logo_path/)
    assert.match(source('supabase-migration-046-case-studies.sql'), /CREATE TABLE IF NOT EXISTS case_studies/)
    assert.match(source('supabase-migration-045-partner-logos.sql'), /partner-logos/)
    assert.match(source('src/lib/partner-logos.ts'), /listActivePartnerLogoRows/)
    assert.match(source('src/components/admin/AdminPartnerAccountsPanel.tsx'), /Open /)
    assert.match(source('src/lib/marketing-pipeline.ts'), /href: '\/admin\/case-study'/)
    assert.match(source('src/app/admin/referrals/page.tsx'), /tab=partners/)
    assert.match(source('src/app/api/partner/route.ts'), /requirePartnerSession/)
    assert.match(source('src/components/partner/PartnerShell.tsx'), /\/partner\/toolkit/)
    assert.match(source('src/app/partner/page.tsx'), /Current scores/)
    assert.match(source('src/app/partner/page.tsx'), /choose Build or Fund/)
    assert.match(source('src/app/partner/page.tsx'), /href="\/build-fund"/)
    assert.match(source('src/app/partner/page.tsx'), /sm:hidden/)
    assert.match(source('src/components/referrals/ReferralLinkQrPanel.tsx'), /Scans to the Build or Fund chooser/)
    assert.doesNotMatch(source('src/components/referrals/ReferralLinkQrPanel.tsx'), /credit intake link/)
    assert.match(source('src/lib/partner-service.ts'), /decryptFieldOrLegacy/)
    assert.match(source('src/lib/partner-service.ts'), /existing\.status === status/)
    assert.match(source('src/app/api/partner/route.ts'), /logApiRouteError/)
    assert.match(source('src/components/admin/AdminPartnerAccountsPanel.tsx'), /Open/)
    assert.match(source('src/app/funding/page.tsx'), /isPartnerIntakeFirst/)
    assert.match(source('src/app/credit/page.tsx'), /isPartnerIntakeFirst/)
    assert.match(source('src/app/build-fund/page.tsx'), /fromReferral/)
    assert.match(source('src/app/api/referrals/track/route.ts'), /appendReferralChooser/)
    assert.match(source('src/lib/referral-qr.ts'), /buildReferralPath/)
    assert.match(source('src/app/partner/page.tsx'), /TransUnion/)
    assert.match(source('src/lib/partner-service.ts'), /currentScoresForApplication/)
    assert.match(source('src/lib/partner-service.ts'), /buildCreditProgressDiff/)
    assert.doesNotMatch(source('src/app/partner/page.tsx'), /\bssn\b|social security|date of birth/i)
  })
})
