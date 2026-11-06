import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const SECRET = process.env.NEXTAUTH_SECRET || 'e2e-prospect-file-secret'
const ARTIFACTS = '/opt/cursor/artifacts'

test.use({
  video: 'on',
})

const QR_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const partnerRow = {
  id: 'partner-1',
  name: 'Alex Rivera',
  email: 'alex@broker.example',
  phone: '215-555-0100',
  companyName: 'Rivera Lending',
  serviceArea: 'Philadelphia',
  yearsInField: 8,
  profession: 'Mortgage broker',
  status: 'active',
  code: 'RIVERA8',
  link: 'http://127.0.0.1:3000/credit?ref=RIVERA8',
  linkActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  clicks: 4,
  submitted: 2,
  inProgress: 1,
  completed: 1,
  logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
}

function overflowAmount() {
  return document.documentElement.scrollWidth - window.innerWidth
}

async function signIn(page: Page) {
  const token = await encode({
    token: {
      sub: 'admin-1',
      email: 'sales@sundayharmony.com',
      name: 'Admin',
      role: 'admin',
      mfaVerified: true,
      mfaPending: false,
      mfaEnrollmentRequired: false,
      staffSessionStartedAt: Math.floor(Date.now() / 1000),
      lastDbCheckAt: Date.now(),
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
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        user: {
          name: 'Admin',
          email: 'sales@sundayharmony.com',
          role: 'admin',
          mfaVerified: true,
        },
      },
    })
  })
  await page.route('**/api/referral-qr**', async (route) => {
    await route.fulfill({ contentType: 'image/png', body: QR_PNG })
  })
  await page.route('**/api/admin/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/admin/partners') {
      const id = url.searchParams.get('id')
      if (id) {
        await route.fulfill({
          json: {
            partner: partnerRow,
            summary: { clicks: 4, submitted: 2, inProgress: 1, completed: 1 },
            referrals: [],
          },
        })
        return
      }
      await route.fulfill({ json: { partners: [partnerRow] } })
      return
    }
    if (path === '/api/admin/referrals') {
      await route.fulfill({
        json: {
          overview: {
            referralClients: 1,
            clicks: 3,
            submitted: 1,
            paidApplicants: 0,
            earnedCents: 0,
            paidCents: 0,
            outstandingCents: 0,
            pendingPayouts: 0,
          },
          clients: [
            {
              clientId: 'c1',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              code: 'ADA123',
              status: 'active',
              availableCents: 0,
              link: 'http://127.0.0.1:3000/credit?ref=ADA123',
            },
          ],
          creditReferrals: [],
          payouts: [],
        },
      })
      return
    }
    if (path.includes('staff-direct-messages')) {
      await route.fulfill({ json: { colleagues: [] } })
      return
    }
    if (path.includes('message-alerts')) {
      await route.fulfill({ json: { alerts: [] } })
      return
    }
    if (path.includes('notifications')) {
      await route.fulfill({ json: { notifications: [] } })
      return
    }
    await route.fulfill({ json: {} })
  })
}

test('admin referrals workspace and case study replace the old partners tab', async ({ page }) => {
  test.setTimeout(60_000)
  mkdirSync(ARTIFACTS, { recursive: true })
  await signIn(page)

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/admin/referrals')
  await expect(page.getByRole('heading', { name: 'Referrals' })).toBeVisible()
  await expect(page.locator('aside a[href="/admin/referrals"]')).toBeVisible()
  await expect(page.locator('aside a[href="/admin/case-study"]')).toBeVisible()
  await expect(page.locator('aside a[href="/admin/partners"]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Client referrers' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Ada Lovelace')).toBeVisible()
  await page.screenshot({ path: `${ARTIFACTS}/admin-referrals-clients-desktop.png`, fullPage: true })

  await page.getByRole('link', { name: 'Partners', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/referrals\?tab=partners/)
  await expect(page.getByRole('heading', { name: 'Email a signup link' })).toBeVisible()
  await expect(page.getByText('Rivera Lending')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload logo' })).toHaveCount(0)
  await page.getByText('Rivera Lending').click()
  await expect(page.getByRole('heading', { name: 'Partner referral link' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  await page.screenshot({ path: `${ARTIFACTS}/admin-referrals-partners-desktop.png`, fullPage: true })

  await page.goto('/admin/partners')
  await expect(page).toHaveURL(/\/admin\/referrals\?tab=partners/)
  await expect(page.getByRole('heading', { name: 'Email a signup link' })).toBeVisible()

  await page.locator('aside a[href="/admin/case-study"]').click()
  await expect(page).toHaveURL(/\/admin\/case-study/)
  await expect(page.getByRole('heading', { name: 'Case Study' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'About page preview' })).toBeVisible()
  await page.locator('table tbody tr').filter({ hasText: 'Rivera Lending' }).click()
  await expect(page.getByRole('button', { name: 'Upload logo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible()
  await page.screenshot({ path: `${ARTIFACTS}/admin-case-study-desktop.png`, fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/referrals')
  await page.getByRole('button', { name: 'Toggle menu' }).click()
  await expect(page.locator('aside')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await expect(page.locator('aside a[href="/admin/case-study"]')).toBeInViewport()
  await expect(page.locator('aside a[href="/admin/referrals"]')).toBeInViewport()
  await expect(page.locator('aside a[href="/admin/partners"]')).toHaveCount(0)
  await page.locator('aside').screenshot({ path: `${ARTIFACTS}/admin-referrals-nav-mobile-390.png` })
  await page.getByRole('button', { name: 'Toggle menu' }).click()
  await expect(page.locator('aside')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -240, 0)')
  await expect(page.getByRole('link', { name: 'Client referrers' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Partners', exact: true })).toBeVisible()
  expect(await page.evaluate(overflowAmount)).toBeLessThanOrEqual(8)
  await page.screenshot({ path: `${ARTIFACTS}/admin-referrals-clients-mobile-390.png`, fullPage: true })

  await page.getByRole('link', { name: 'Partners', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Email a signup link' })).toBeVisible()
  expect(await page.evaluate(overflowAmount)).toBeLessThanOrEqual(8)
  await page.screenshot({ path: `${ARTIFACTS}/admin-referrals-partners-mobile-390.png`, fullPage: true })

  await page.goto('/admin/case-study')
  await expect(page.getByRole('heading', { name: 'Case Study' })).toBeVisible()
  await page.getByRole('button', { name: 'Toggle menu' }).click()
  await expect(page.locator('aside')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await expect(page.locator('aside a[href="/admin/case-study"]')).toBeInViewport()
  await page.getByRole('button', { name: 'Toggle menu' }).click()
  await expect(page.locator('aside')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -240, 0)')
  await page.locator('table tbody tr').filter({ hasText: 'Rivera Lending' }).click()
  await expect(page.getByRole('button', { name: 'Upload logo' })).toBeVisible()
  expect(await page.evaluate(overflowAmount)).toBeLessThanOrEqual(8)
  await page.screenshot({ path: `${ARTIFACTS}/admin-case-study-mobile-390.png`, fullPage: true })
})
