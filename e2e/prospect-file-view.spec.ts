import { expect, test, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const SECRET = process.env.NEXTAUTH_SECRET || 'e2e-prospect-file-secret'
const PROSPECT_ID = 'lead-view-1'

test.use({
  video: { mode: 'on', size: { width: 1280, height: 720 } },
})

const prospect = {
  id: PROSPECT_ID,
  business: 'Pastelería y Panadería Los Claveles',
  contactName: '',
  email: '',
  phone: '(302) 256-0881',
  industry: 'Bakery / panadería / pastelería',
  website: '',
  location: 'Wilmington, DE',
  category: 'established',
  opportunity:
    'Mexican pasteleria/panaderia with ~200 Google reviews but Facebook-as-website and no Instagram/email found.',
  recommendedService: 'Business Essentials $599',
  scoreFactors: { weakness: 2, operating: 2, need: 2, decision_maker: 2, ability: 1 },
  source: 'outbound',
  lastContactedAt: null,
  followUpAt: '2026-11-06T14:00:00.000Z',
  stage: 'ready_to_contact',
  estimatedValue: 599,
  notes: 'Opener: Los Claveles team — for conchas and tres leches, but still no branded website.',
  gmailThreadId: null,
  driveFolderUrl: null,
  proposalDocUrl: null,
  agreementSignedAt: null,
  paymentStatus: '',
  servicesPurchased: '',
  scope: '',
  deliverables: '',
  deadline: '',
  promises: '',
  expectations: '',
  creditApplicationId: null,
  closeMethod: null,
}

async function signInAndMockApis(page: Page) {
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

  await page.route('**/api/admin/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (url.includes(`/api/admin/pipeline/${PROSPECT_ID}`)) {
      if (method === 'PATCH') {
        const body = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({
          json: { prospect: { ...prospect, ...body } },
        })
        return
      }
      await route.fulfill({
        json: { prospect, scripts: [], meetings: [], workspaceConnected: false, stripePaid: false },
      })
      return
    }
    await route.fulfill({ json: { colleagues: [], alerts: [], notifications: [] } })
  })

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
}

test.describe('prospect file view mode', () => {
  test('opens as a file, not an editor, until Edit is clicked', async ({ page }) => {
    await signInAndMockApis(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/admin/pipeline/${PROSPECT_ID}`)

    await expect(page.getByRole('heading', { name: prospect.business })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(page.getByLabel(/Pipeline stage/i)).toHaveValue('ready_to_contact')
    await expect(page.getByText('Current status')).toBeVisible()
    await expect(page.getByText('Wilmington, DE')).toBeVisible()
    await expect(page.getByText('Business Essentials $599')).toBeVisible()
    await expect(page.getByLabel(/Business name/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save prospect' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Close' })).toHaveCount(0)

    await page.screenshot({
      path: '/opt/cursor/artifacts/prospect-file-view-desktop.png',
      fullPage: true,
    })

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(page.getByLabel(/Business name/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save prospect' })).toBeVisible()
    await expect(page.getByLabel(/Pipeline stage/i)).toHaveValue('ready_to_contact')

    await page.screenshot({
      path: '/opt/cursor/artifacts/prospect-file-edit-desktop.png',
      fullPage: true,
    })

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(page.getByLabel(/Business name/i)).toHaveCount(0)
  })

  test('keeps the same view-first layout at phone width', async ({ page }) => {
    await signInAndMockApis(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/admin/pipeline/${PROSPECT_ID}`)

    await expect(page.getByRole('heading', { name: prospect.business })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(page.getByLabel(/Pipeline stage/i)).toBeVisible()
    await expect(page.getByLabel(/Business name/i)).toHaveCount(0)

    await page.screenshot({
      path: '/opt/cursor/artifacts/prospect-file-view-mobile.png',
      fullPage: true,
    })

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(page.getByLabel(/Business name/i)).toBeVisible()

    await page.screenshot({
      path: '/opt/cursor/artifacts/prospect-file-edit-mobile.png',
      fullPage: true,
    })
  })

  test('shows Close after Stripe confirms payment', async ({ page }) => {
    await signInAndMockApis(page)
    await page.route(`**/api/admin/pipeline/${PROSPECT_ID}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      await route.fulfill({
        json: {
          prospect: { ...prospect, stage: 'won' },
          scripts: [],
          meetings: [],
          workspaceConnected: false,
          stripePaid: true,
        },
      })
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/admin/pipeline/${PROSPECT_ID}`)

    await expect(page.getByRole('heading', { name: 'Close' })).toBeVisible()
    await expect(page.getByText('Stripe confirmed payment')).toBeVisible()
    await page.screenshot({
      path: '/opt/cursor/artifacts/prospect-file-close-after-stripe.png',
      fullPage: true,
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('heading', { name: 'Close' })).toBeVisible()
    await page.getByRole('heading', { name: 'Close' }).scrollIntoViewIfNeeded()
    await page.screenshot({
      path: '/opt/cursor/artifacts/prospect-file-close-after-stripe-mobile.png',
    })
  })
})
