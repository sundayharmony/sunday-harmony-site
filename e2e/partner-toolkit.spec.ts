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

async function mockPartnerDashboard(page: Page) {
  await page.route('**/api/partner', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await route.fulfill({
      json: {
        profile: {
          name: 'Alex Rivera',
          companyName: 'Rivera Lending',
          serviceArea: 'Philadelphia',
          profession: 'mortgage',
          yearsInField: 8,
          status: 'active',
          code: 'ABCD1234',
          link: 'http://127.0.0.1:3000/credit?ref=ABCD1234',
          linkActive: true,
        },
        summary: { clicks: 3, submitted: 1, inProgress: 1, completed: 0 },
        referrals: [],
      },
    })
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
  await page.screenshot({ path: `${ARTIFACTS}/partner-dashboard-desktop.png`, fullPage: true })

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
  await expect(page.getByRole('heading', { name: 'Share your QR code or intake link.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your intake link' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download QR code' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'QR code for Your intake link' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Open Your referral/ })).toHaveCount(0)
  await page.screenshot({ path: `${ARTIFACTS}/partner-toolkit-desktop.png`, fullPage: true })
  await page.locator('#next-step').screenshot({ path: `${ARTIFACTS}/partner-toolkit-next-step-desktop.png` })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/partner/toolkit')
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Toolkit' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Person', exact: true }).first()).toBeVisible()
  await expect(page.getByText('The client path')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Secure intake' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Take action' })).toBeVisible()
  await expect(page.getByText('How the pieces fit')).toBeVisible()
  await page.getByRole('navigation', { name: 'Toolkit sections' }).getByRole('link', { name: 'Next step' }).click()
  await expect(page.getByRole('heading', { name: 'Share your QR code or intake link.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  expect(await page.evaluate(overflowAmount)).toBeLessThanOrEqual(8)
  await page.screenshot({ path: `${ARTIFACTS}/partner-toolkit-mobile-390.png`, fullPage: true })
  await page.locator('#next-step').screenshot({ path: `${ARTIFACTS}/partner-toolkit-next-step-mobile-390.png` })

  await nav.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Partner dashboard' })).toBeVisible()
  await page.screenshot({ path: `${ARTIFACTS}/partner-dashboard-mobile-390.png`, fullPage: true })
})
