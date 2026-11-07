import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const SECRET = process.env.NEXTAUTH_SECRET || 'e2e-prospect-file-secret'
const ARTIFACTS = '/opt/cursor/artifacts'

test.use({
  video: 'on',
})

async function setRoleCookie(
  page: Page,
  role: 'partner' | 'admin' | 'client',
  extras: Record<string, unknown> = {}
) {
  const token = await encode({
    token: {
      sub: `${role}-1`,
      email: `${role}@sundayharmony.com`,
      name: role,
      role,
      mfaVerified: role !== 'partner' && role !== 'client',
      mfaPending: false,
      mfaEnrollmentRequired: false,
      staffSessionStartedAt: Math.floor(Date.now() / 1000),
      lastDbCheckAt: Date.now(),
      ...extras,
    },
    secret: SECRET,
  })
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: token,
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

const QR_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

type PartnerDashboardMock = {
  linkActive?: boolean
  status?: string
  closed?: number
}

function partnerDashboardPayload(overrides: PartnerDashboardMock = {}) {
  const linkActive = overrides.linkActive ?? true
  return {
    profile: {
      name: 'Alex Rivera',
      email: 'alex@broker.example',
      phone: '215-555-0100',
      companyName: 'Rivera Lending',
      serviceArea: 'Philadelphia',
      profession: 'Mortgage',
      professionValue: 'mortgage',
      yearsInField: 8,
      status: overrides.status ?? (linkActive ? 'active' : 'pending'),
      code: 'ABCD1234',
      link: 'http://127.0.0.1:3000/build-fund?ref=ABCD1234',
      linkActive,
    },
    summary: {
      clicks: 3,
      submitted: 2,
      inProgress: 1,
      completed: 0,
      closed: overrides.closed ?? 1,
    },
    referrals: [
      {
        id: 'ref-1',
        date: '2026-11-06T16:00:00.000Z',
        applicant: 'Jane D.',
        stage: 'Under review',
        updatedAt: '2026-11-06T18:00:00.000Z',
        disputeRound: 2,
        currentScores: { transunion: 710, experian: 698, equifax: 705 },
      },
    ],
  }
}

async function mockPartnerDashboard(page: Page, overrides: PartnerDashboardMock = {}) {
  let payload = partnerDashboardPayload(overrides)
  await page.route('**/api/partner/notifications', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { message: 'Notification marked as read' } })
      return
    }
    await route.fulfill({
      json: [
        {
          id: 'n1',
          title: 'New referral application',
          message: 'Someone used your partner link and submitted a credit or funding application.',
          type: 'info',
          link: '/partner',
          read: false,
          created_at: '2026-11-06T16:00:00.000Z',
        },
      ],
    })
  })
  await page.route('**/api/partner', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as {
        action?: string
        companyName?: string
        fullName?: string
        phone?: string
        serviceArea?: string
        yearsInField?: string
        profession?: string
      }
      if (body.action === 'profile') {
        payload = {
          ...payload,
          profile: {
            ...payload.profile,
            name: body.fullName || payload.profile.name,
            phone: body.phone || payload.profile.phone,
            companyName: body.companyName || payload.profile.companyName,
            serviceArea: body.serviceArea || payload.profile.serviceArea,
            yearsInField: Number(body.yearsInField) || payload.profile.yearsInField,
            professionValue: body.profession || payload.profile.professionValue,
          },
        }
        await route.fulfill({ json: { ok: true, profile: payload.profile } })
        return
      }
      await route.fulfill({ json: { ok: true } })
      return
    }
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await route.fulfill({ json: payload })
  })
  await page.route('**/api/referral-qr**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: QR_PNG,
    })
  })
}

function overflowAmount() {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth
}

test('unauthenticated visitors cannot open the partner toolkit', async ({ page }) => {
  await page.goto('/partner/toolkit')
  await expect(page).toHaveURL(/\/login/)
})

test('staff and clients are kept off the partner toolkit', async ({ page }) => {
  await setRoleCookie(page, 'admin', { mfaVerified: true })
  await page.goto('/partner/toolkit')
  expect(new URL(page.url()).pathname.startsWith('/partner')).toBe(false)
  await expect(page.getByRole('navigation', { name: 'Partner' })).toHaveCount(0)

  await page.context().clearCookies()
  await setRoleCookie(page, 'client')
  await page.goto('/partner/toolkit')
  expect(new URL(page.url()).pathname.startsWith('/partner')).toBe(false)
  await expect(page.getByRole('heading', { name: 'Simple words for credit and funding.' })).toHaveCount(0)
})

test('partner toolkit tab, copy controls, and diagrams work on desktop and 390px', async ({ page, context }) => {
  mkdirSync(ARTIFACTS, { recursive: true })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await setRoleCookie(page, 'partner')
  await mockPartnerDashboard(page)

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/partner')
  await expect(page.getByRole('heading', { name: 'Partner dashboard' })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Partner' })
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Toolkit' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Account' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Jane D.' })).toBeVisible()
  await expect(page.getByRole('cell').filter({ hasText: 'TransUnion' })).toBeVisible()
  await expect(page.getByText('Closed', { exact: true })).toBeVisible()
  await expect(page.getByText('Scans to the Build or Fund chooser')).toBeVisible()
  await expect(page.getByText('Scans to your credit intake link')).toHaveCount(0)
  await page.getByRole('button', { name: 'Notifications' }).click()
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible()
  await expect(page.getByText('New referral application')).toBeVisible()
  await page.screenshot({ path: `${ARTIFACTS}/partner-dashboard-desktop.png`, fullPage: true })
  await page.keyboard.press('Escape')

  await nav.getByRole('link', { name: 'Toolkit' }).click()
  await expect(page).toHaveURL(/\/partner\/toolkit/)
  await expect(page.getByRole('heading', { name: 'Simple words for credit and funding.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Personal credit', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Business credit', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Personal guarantee', exact: true }).first()).toBeVisible()
  await expect(page.getByText('Accurate, current negative information cannot simply be removed.')).toBeVisible()
  await expect(page.getByText(/commission/i)).toHaveCount(0)
  await expect(page.locator('a[href*="sales-kit"]')).toHaveCount(0)
  await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0)

  await page.getByRole('navigation', { name: 'Toolkit sections' }).getByRole('link', { name: 'What to say' }).click()
  await expect(page.getByRole('heading', { name: 'One true sentence at a time.' })).toBeVisible()
  await page.getByRole('button', { name: 'Copy: What credit repair does' }).click()
  await expect(page.getByRole('button', { name: 'Copied: What credit repair does' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Toolkit sections' }).getByRole('link', { name: 'Next step' }).click()
  await expect(page.getByRole('heading', { name: 'Share your QR code or referral link.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your referral link' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download QR code' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'QR code for Your referral link' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Open Your referral/ })).toHaveCount(0)
  await page.screenshot({ path: `${ARTIFACTS}/partner-toolkit-desktop.png`, fullPage: true })
  await page.locator('#next-step').screenshot({ path: `${ARTIFACTS}/partner-toolkit-next-step-desktop.png` })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/partner/toolkit')
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Toolkit' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Account' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Person', exact: true }).first()).toBeVisible()
  await expect(page.getByText('The client path')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Secure intake' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Take action' })).toBeVisible()
  await expect(page.getByText('How the pieces fit')).toBeVisible()
  await page.getByRole('navigation', { name: 'Toolkit sections' }).getByRole('link', { name: 'Next step' }).click()
  await expect(page.getByRole('heading', { name: 'Share your QR code or referral link.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  expect(await page.evaluate(overflowAmount)).toBeLessThanOrEqual(8)
  await page.screenshot({ path: `${ARTIFACTS}/partner-toolkit-mobile-390.png`, fullPage: true })
  await page.locator('#next-step').screenshot({ path: `${ARTIFACTS}/partner-toolkit-next-step-mobile-390.png` })

  await nav.getByRole('link', { name: 'Account' }).click()
  await expect(page).toHaveURL(/\/partner\/account/)
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
  await expect(page.getByLabel('Company')).toHaveValue('Rivera Lending')
  await page.getByLabel('Company').fill('Rivera Lending Co')
  await page.getByRole('button', { name: 'Save details' }).click()
  await expect(page.getByText('Account details saved.')).toBeVisible()
  expect(await page.evaluate(overflowAmount)).toBeLessThanOrEqual(8)
  await page.screenshot({ path: `${ARTIFACTS}/partner-account-mobile-390.png`, fullPage: true })

  await nav.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Partner dashboard' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Jane D.' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'TransUnion' })).toBeVisible()
  expect(await page.evaluate(overflowAmount)).toBeLessThanOrEqual(8)
  await page.screenshot({ path: `${ARTIFACTS}/partner-dashboard-mobile-390.png`, fullPage: true })
})

test('inactive partner links cannot be copied or scanned', async ({ page }) => {
  mkdirSync(ARTIFACTS, { recursive: true })
  await setRoleCookie(page, 'partner')
  await mockPartnerDashboard(page, { linkActive: false, status: 'pending' })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/partner')
  await expect(page.getByText('Copy, QR, and scans stay off until Sunday Harmony approves this account.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Download QR code' })).toHaveCount(0)
  await expect(page.getByRole('img', { name: /QR code/ })).toHaveCount(0)
  await expect(page.getByText('Not scannable until approved')).toBeVisible()
  await expect(page.locator('input[aria-label="Partner referral link is inactive"]')).toHaveValue(
    'Available after Sunday Harmony approves this account'
  )
  await page.screenshot({ path: `${ARTIFACTS}/partner-inactive-link-desktop.png`, fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/partner')
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible()
  expect(await page.evaluate(overflowAmount)).toBeLessThanOrEqual(8)
  await page.screenshot({ path: `${ARTIFACTS}/partner-inactive-link-mobile-390.png`, fullPage: true })
})
