import { expect, test, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const SECRET = process.env.NEXTAUTH_SECRET || 'e2e-prospect-file-secret'

test.use({
  video: 'on',
})

async function signInAndMockPipeline(page: Page) {
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
  await page.route('**/api/admin/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/api/admin/pipeline') && !url.includes('/api/admin/pipeline/') && route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          role: 'admin',
          prospects: [],
          lanes: [
            {
              id: 'research',
              title: 'Research',
              detail: 'First look',
              stages: ['researching'],
            },
          ],
        },
      })
      return
    }
    if (url.includes('/api/admin/pipeline') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { followUpAt?: string; business?: string }
      expect(body.followUpAt || '').toBe('')
      expect(body.business).toBe('Manual Follow-up Bakery')
      await route.fulfill({ json: { id: 'lead-new-1', warning: 'Prospect added.' } })
      return
    }
    await route.fulfill({ json: { colleagues: [], alerts: [], notifications: [] } })
  })
}

test.describe('optional follow-up dates', () => {
  test('lets staff add a prospect without a follow-up on desktop and phone', async ({ page }) => {
    await signInAndMockPipeline(page)

    for (const viewport of [
      { width: 1280, height: 900, shot: 'pipeline-follow-up-optional-desktop.png' },
      { width: 390, height: 844, shot: 'pipeline-follow-up-optional-mobile.png' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/admin/pipeline')
      await page.getByRole('button', { name: 'Add prospect' }).click()
      const followUp = page.getByTestId('follow-up-input')
      await expect(followUp).toBeVisible()
      await expect(followUp).not.toHaveAttribute('required')
      await expect(page.getByText('Optional reminder. Set only when you actually need one.')).toBeVisible()
      await page.screenshot({ path: `/opt/cursor/artifacts/${viewport.shot}`, fullPage: true })
    }

    await page.getByLabel('Business name').fill('Manual Follow-up Bakery')
    await page.getByRole('button', { name: 'Save prospect' }).click()
    await expect(page.getByText('Prospect added.')).toBeVisible()
  })
})
